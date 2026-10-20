#!/usr/bin/env python3
"""Read-only local MySQL export. Raw snapshots and full inventories stay private."""
import argparse
import configparser
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.private'
KINDS = {'signal', 'depth', 'node'}
CONTENT_FIELDS = ('id kind slug title summary body category topics author source sourceUrl cover '
                  'status publishedAt updatedAt readMinutes featured seoTitle seoDescription '
                  'route stage year people order related revision').split()
SETTINGS_FIELDS = ('brand tagline wechatName qrCode about consulting contact defaultTheme '
                   'seoDescription navigation heroId signalIds featuredIds sidebarIds').split()


def write_json(path, value, private=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    if private:
        os.chmod(temp, 0o600)
    temp.replace(path)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


def overlaps(items):
    groups = []
    for field in ('title', 'body', 'sourceUrl'):
        values = {}
        for item in items:
            if item.get(field):
                values.setdefault((item['kind'], item[field]), []).append(item)
        for (kind, value), records in values.items():
            if len(records) > 1:
                groups.append({'kind': kind, 'sharedField': field,
                               'valueSha256': hashlib.sha256(value.encode()).hexdigest(),
                               **({'sourceUrl': value} if field == 'sourceUrl' else {}),
                               'records': [{'id': x['id'], 'slug': x['slug'], 'title': x['title']} for x in records],
                               'decision': 'keep-distinct-records; shared source alone does not prove duplicate text'})
    return groups


def reason(item, at):
    if item.get('status') not in ('published', 'scheduled'):
        return item.get('status') or 'missing-status'
    try:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})', item['publishedAt']):
            return 'invalid-publishedAt'
        value = datetime.fromisoformat(item['publishedAt'].replace('Z', '+00:00'))
        if value.tzinfo is None:
            return 'invalid-publishedAt'
        if value > at:
            return 'future-publication'
    except (KeyError, ValueError, TypeError):
        return 'invalid-publishedAt'
    return None


def bundle(path):
    data = json.loads(path.read_text())
    if isinstance(data, list):
        return data
    items = copy.deepcopy(data.get('contents', []))
    for item in items:
        if 'bodyFile' in item:
            body_path = (path.parent / item.pop('bodyFile')).resolve()
            if not body_path.is_relative_to(path.parent.resolve()):
                raise ValueError('内容包正文越界')
            item['body'] = body_path.read_text().strip()
    return items


def inventory(source, current=None):
    """Compare every known state/content package, never merge historical snapshots."""
    paths = sorted(set([*source.glob('content/**/manifest.json'),
                        *source.glob('artifacts/**/*.json'), source / 'backend/data/site.json']))
    existing = {x['id']: x for x in (current or {}).get('contents', [])}
    slug_map = {(x['kind'], x['slug']): x['id'] for x in existing.values()}
    results = []
    for path in paths:
        if not path.is_file():
            if path == source / 'backend/data/site.json':
                results.append({'source': str(path.relative_to(source)), 'exists': False})
            continue
        try:
            items = bundle(path)
        except (ValueError, KeyError, TypeError):
            continue
        if not items or not all(isinstance(x, dict) and {'id', 'kind', 'slug'} <= x.keys() for x in items):
            continue
        rows = []
        for item in items:
            old = existing.get(item['id'])
            changed = []
            if old is not None:
                keys = set(item) - {'revision', 'updatedAt'}
                changed = [key for key in sorted(keys) if (item.get(key) or [] if key in ('people', 'related', 'topics') else item.get(key)) !=
                           (old.get(key) or [] if key in ('people', 'related', 'topics') else old.get(key))]
            rows.append({'id': item['id'], 'kind': item['kind'], 'slug': item['slug'],
                         'status': item.get('status'), 'inCurrent': old is not None,
                         'changedFields': changed,
                         'pathConflict': slug_map.get((item['kind'], item['slug'])) not in (None, item['id']),
                         'decision': 'current-database-wins' if old else 'inventory-only-not-published'})
        results.append({'source': str(path.relative_to(source)), 'exists': True,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'count': len(items),
                        'kinds': dict(Counter(x['kind'] for x in items)),
                        'statuses': dict(Counter(x.get('status', 'unknown') for x in items)),
                        'missingFromCurrent': sum(not x['inCurrent'] for x in rows) if current else None,
                        'changedFromCurrent': sum(bool(x['changedFields']) for x in rows) if current else None,
                        'records': rows})
    return results


def read_mysql(args):
    config = args.mysql_config.resolve()
    client = shutil.which('mysql')
    if not client:
        raise ValueError('缺少 mysql 客户端；安装本机 MySQL 客户端后重试')
    options = []
    cfg = {}
    if config.exists():
        if config.stat().st_mode & 0o077:
            raise ValueError('安全配置文件权限必须为 600：请运行 chmod 600 <配置路径>')
        parser = configparser.ConfigParser(interpolation=None)
        parser.read(config)
        cfg = dict(parser['client']) if 'client' in parser else {}
        # MySQL option files override MYSQL_PWD. An explicitly supplied environment
        # password must not be shadowed by a template's empty password entry.
        if not os.getenv('DB_PASSWORD'):
            options.append('--defaults-extra-file=' + str(config))
    if os.getenv('DB_PASSWORD'):
        options.insert(0, '--no-defaults')
    host = os.getenv('DB_HOST', cfg.get('host', '127.0.0.1'))
    if host not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('只读导出只允许本机 MySQL')
    name = args.database
    if not re.fullmatch(r'[a-zA-Z0-9_]+', name):
        raise ValueError('数据库名称不合法')
    # Explicit loopback host overrides client defaults; passwords never enter argv.
    options += ['--host=' + host, '--port=' + os.getenv('DB_PORT', cfg.get('port', '3306')),
                '--user=' + os.getenv('DB_USER', cfg.get('user', 'root')),
                '--database=' + name, '--connect-timeout=5', '--default-character-set=utf8mb4',
                '--batch', '--raw', '--skip-column-names']
    env = dict(os.environ)
    if os.getenv('DB_PASSWORD'):
        env['MYSQL_PWD'] = os.environ['DB_PASSWORD']
    sql = ("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ; START TRANSACTION READ ONLY; "
           "SELECT JSON_OBJECT('database', DATABASE(), 'updatedAt', CAST(updated_at AS CHAR), "
           "'payload', payload) FROM site_state WHERE id=1; ROLLBACK;")
    result = subprocess.run([client, *options], input=sql, text=True, capture_output=True, env=env)
    if result.returncode:
        code = re.search(r'ERROR (\d+)', result.stderr)
        raise ValueError('本机 MySQL 只读连接失败' + ('（错误码 ' + code[1] + '）' if code else '') +
                         '；检查服务、数据库名称及 .private/mysql.cnf，不会使用备份替代')
    try:
        data = json.loads(result.stdout)
        state = data['payload']
        if isinstance(state, str):
            state = json.loads(state)
        if not isinstance(state.get('contents'), list):
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise ValueError('site_state.id=1 不存在或数据结构不正确；未执行初始化') from None
    return state, {'type': 'mysql', 'database': name, 'row': 'site_state.id=1',
                   'databaseUpdatedAt': data['updatedAt'], 'host': host, 'readOnly': True}


def export(state, source, meta, at):
    previous_media = []
    previous_manifest = ROOT / 'content/provenance.json'
    if previous_manifest.is_file():
        previous_media = json.loads(previous_manifest.read_text()).get('referencedLocalMedia', [])
    all_items = state['contents']
    ids, slugs = set(), set()
    for item in all_items:
        if item['kind'] not in KINDS or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,100}', item['slug']):
            raise ValueError('记录包含无效类型或 slug；请先核对私密盘点')
        key = (item['kind'], item['slug'])
        if item['id'] in ids or key in slugs:
            raise ValueError('当前数据含重复 ID 或路径，停止导出')
        ids.add(item['id']); slugs.add(key)
    visible = [x for x in all_items if reason(x, at) is None]
    public_ids = {x['id'] for x in visible}
    exclusions = [{'id': x['id'], 'kind': x['kind'], 'slug': x['slug'], 'status': x['status'],
                   'reason': reason(x, at)} for x in all_items if x['id'] not in public_ids]
    candidates = inventory(source, state)
    records = [{'id': x['id'], 'kind': x['kind'], 'slug': x['slug'], 'status': x['status'],
                'public': x['id'] in public_ids, 'reason': reason(x, at), 'sha256': digest(x)} for x in all_items]
    private_report = {'exportedAt': at.isoformat(), 'source': meta, 'total': len(all_items),
                      'records': records, 'exclusions': exclusions, 'candidates': candidates,
                      'potentialOverlaps': overlaps(all_items)}
    write_json(PRIVATE / 'migration-audit.json', private_report, True)
    contents = [{key: copy.deepcopy(x[key]) for key in CONTENT_FIELDS if key in x} for x in visible]
    for x in contents:
        x['status'] = 'published'
        x['related'] = [key for key in (x.get('related') or []) if key in public_ids]
        x['topics'] = x.get('topics') or []
        x['people'] = x.get('people') or []
    topics = [{k: copy.deepcopy(x[k]) for k in ('slug', 'name', 'description', 'cover', 'heat', 'count') if k in x} for x in state['topics']]
    for topic in topics:
        topic['count'] = sum(topic['slug'] in x['topics'] for x in contents)
    settings = {k: copy.deepcopy(state['settings'][k]) for k in SETTINGS_FIELDS if k in state['settings']}
    for key in ('signalIds', 'featuredIds', 'sidebarIds'):
        settings[key] = [x for x in (settings.get(key) or []) if x in public_ids]
    settings['heroId'] = settings.get('heroId') if settings.get('heroId') in public_ids else ''
    public = {'contents': contents, 'topics': topics,
              'routes': [{k: copy.deepcopy(x[k]) for k in ('slug', 'name', 'description', 'steps') if k in x} for x in state['routes']],
              'stages': [{k: copy.deepcopy(x[k]) for k in ('name', 'period', 'description') if k in x} for x in state['stages']],
              'settings': settings, 'media': []}
    # Copy only referenced local assets, including Markdown reference-style destinations.
    media_refs = set()
    for value in [*contents, topics, settings]:
        text = json.dumps(value, ensure_ascii=False)
        media_refs.update(re.findall(r'/(?:uploads|design)/[^\s"<>\\)\]]+', text))
    copied = []
    for url in sorted(media_refs):
        path = unquote(urlsplit(url).path)
        prefix = path.split('/')[1]
        base = source / ('backend/data' if prefix == 'uploads' else 'frontend/public')
        original = (base / path.lstrip('/')).resolve()
        allowed = (base / prefix).resolve()
        if not original.is_relative_to(allowed) or not original.is_file():
            raise ValueError('公开内容引用的本地媒体缺失：' + path)
        dest = (ROOT / 'public' / path.lstrip('/')).resolve()
        if not dest.is_relative_to((ROOT / 'public' / prefix).resolve()):
            raise ValueError('媒体路径越界')
        copied.append((original, dest, path))
    # Fail first, then replace public content. Never publish a partial export on conflicts.
    out = ROOT / 'content'
    staging = PRIVATE / 'content-next'
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir()
    metadata = copy.deepcopy(public)
    manifest_rows = []
    for item in metadata['contents']:
        full = next(x for x in contents if x['id'] == item['id'])
        write_json(staging / 'articles' / item['kind'] / (item['slug'] + '.json'), full)
        manifest_rows.append({'id': item['id'], 'kind': item['kind'], 'slug': item['slug'],
                              'bodySha256': hashlib.sha256(item['body'].encode()).hexdigest(),
                              'bodyCharacters': len(item['body']), 'recordSha256': digest(full)})
        item['body'] = ''
    write_json(staging / 'site.json', metadata)
    provenance = {'schemaVersion': 1, 'exportedAt': at.isoformat(), 'source': meta,
                  'snapshotSha256': digest(state), 'inventoryTotal': len(all_items),
                  'publicTotal': len(contents), 'publicKinds': dict(Counter(x['kind'] for x in contents)),
                  'excludedCounts': dict(Counter(x['reason'] for x in exclusions)),
                  'topics': len(topics), 'routes': len(public['routes']), 'stages': len(public['stages']),
                  'referencedLocalMedia': [x[2] for x in copied], 'records': manifest_rows,
                  'policy': 'Original published()/publicState rules at export time; future records require re-export and rebuild.',
                  'conflictPolicy': 'Current database wins. Historical artifacts are inventory-only; no automatic merge.'}
    write_json(staging / 'provenance.json', provenance)
    if (out / 'articles').exists():
        shutil.rmtree(out / 'articles')
    out.mkdir(exist_ok=True)
    for file in staging.iterdir():
        target = out / file.name
        if target.exists(): target.unlink()
        shutil.move(str(file), str(target))
    shutil.rmtree(staging)
    # Remove only stale files owned by previous database exports. Site-maintained
    # subscription images and other explicit public assets must survive re-export.
    current_media = {x[2] for x in copied}
    for url in set(previous_media) - current_media:
        path = (ROOT / 'public' / unquote(urlsplit(url).path).lstrip('/')).resolve()
        if any(path.is_relative_to((ROOT / 'public' / prefix).resolve()) for prefix in ('uploads', 'design')) and path.is_file():
            path.unlink()
    for original, dest, _ in copied:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, dest)
    write_json(ROOT / 'docs/内容重叠清单.json', {'publicOnly': True, 'groups': overlaps(visible)})
    print(json.dumps({k: provenance[k] for k in ('exportedAt', 'inventoryTotal', 'publicTotal', 'publicKinds',
                                                'excludedCounts', 'topics', 'routes', 'stages')}, ensure_ascii=False))
    missing = [(x['source'], x['missingFromCurrent']) for x in candidates
               if x.get('source', '').startswith('content/') and x.get('missingFromCurrent')]
    if missing:
        print('内容包有未入库记录；仅记入私密盘点，尚未公开：' + json.dumps(missing, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'huangdao')
    parser.add_argument('--mysql-config', type=Path, default=PRIVATE / 'mysql.cnf')
    parser.add_argument('--database', default=os.getenv('DB_NAME', 'huangdao'))
    parser.add_argument('--audit-only', action='store_true', help='只盘点历史来源，不连接数据库、不改公开内容')
    parser.add_argument('--snapshot', type=Path, help='显式使用指定快照；必须同时说明来源，不默认选择备份')
    parser.add_argument('--snapshot-origin', help='手动快照来源与选择依据，写入迁移来源记录')
    args = parser.parse_args()
    PRIVATE.mkdir(exist_ok=True, mode=0o700)
    source = args.source.resolve()
    if source == ROOT or not (source / 'backend/internal/site/model.go').exists():
        raise ValueError('请提供正确的源仓库路径')
    if args.audit_only:
        report = inventory(source)
        write_json(PRIVATE / 'source-inventory.json', report, True)
        print('已盘点 ' + str(len(report)) + ' 个来源；完整记录在 .private/source-inventory.json，未修改公开内容。')
        return
    at = datetime.now(timezone.utc)
    if args.snapshot:
        if not args.snapshot_origin:
            raise ValueError('显式快照必须使用 --snapshot-origin 记录选择依据')
        state = json.loads(args.snapshot.read_text())
        meta = {'type': 'explicit-snapshot', 'origin': args.snapshot_origin, 'readOnly': True}
    else:
        state, meta = read_mysql(args)
    write_json(PRIVATE / 'snapshots' / (at.strftime('%Y%m%dT%H%M%SZ') + '.json'), state, True)
    export(state, source, meta, at)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
