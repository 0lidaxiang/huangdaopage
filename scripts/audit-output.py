#!/usr/bin/env python3
"""Verify public output against the private source inventory without printing secrets."""
import configparser
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PageData(HTMLParser):
    def __init__(self):
        super().__init__(); self.capture=False; self.value=''
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('id') == 'page-data': self.capture=True
    def handle_endtag(self, tag):
        if tag == 'script': self.capture=False
    def handle_data(self, data):
        if self.capture: self.value += data


def main():
    manifest=json.loads((ROOT/'content/provenance.json').read_text())
    expected={x['id']:x for x in manifest['records']}
    public=json.loads((ROOT/'dist/data/site.json').read_text())
    assert {x['id'] for x in public['contents']} == set(expected), '公开索引清单不符'
    checked=0
    for path in (ROOT/'dist/data/articles').rglob('*.json'):
        item=json.loads(path.read_text()); record=expected[item['id']]
        assert item['status']=='published', '发现非公开状态'
        assert hashlib.sha256(item['body'].encode()).hexdigest()==record['bodySha256'], '正文与来源清单不符'
        checked+=1
    assert checked==len(expected), '逐篇 JSON 数量不符'
    for path in (ROOT/'dist').rglob('*.html'):
        parser=PageData();parser.feed(path.read_text()); state=json.loads(parser.value)
        assert {x['id'] for x in state['contents']}==set(expected), '页面注入了额外或缺失记录'
        assert all(x['status']=='published' for x in state['contents']), '页面包含非公开状态'
    secrets=[]
    config=ROOT/'.private/mysql.cnf'
    if config.exists():
        parser=configparser.ConfigParser(interpolation=None);parser.read(config)
        if parser.has_option('client','password'): secrets.append(parser['client']['password'].strip('"\''))
    key=ROOT.parent/'huangdao/backend/data/admin-key'
    if key.exists(): secrets.append(key.read_text().strip())
    audit=ROOT/'.private/migration-audit.json'
    private_ids=set()
    if audit.exists():
        report=json.loads(audit.read_text()); private_ids={x['id'] for x in report['exclusions']}
        assert len(report['records'])==manifest['inventoryTotal'], '原始总盘点数不符'
        assert set(expected).isdisjoint(private_ids), '非公开 ID 出现在公开清单'
        baseline=set(manifest.get('maintenance',{}).get('baselinePublicIds',expected))
        assert baseline|private_ids=={x['id'] for x in report['records']}, '原始与公开/排除清单无法对账'
    for path in (ROOT/'dist').rglob('*'):
        if not path.is_file(): continue
        assert not any(part.startswith('.') or part in ('backend','node_modules') for part in path.relative_to(ROOT/'dist').parts), '构建含私密目录'
        if path.suffix in ('.html','.json','.js','.css','.txt','.xml'):
            text=path.read_text()
            assert all(not secret or len(secret)<8 or secret not in text for secret in secrets), '构建包含凭据'
            assert not re.search(r'https?://(?:localhost|127\.0\.0\.1|\[::1\]):878[78]',text), '构建依赖旧服务'
            if path.suffix in ('.html','.json'):
                assert not any(re.search(r'"id"\s*:\s*"'+re.escape(id)+'"',text) for id in private_ids), '构建包含非公开 ID'
    print(f'构建对账通过：{len(expected)} 条公开正文；{len(private_ids)} 条排除记录；无凭据、非公开记录和旧后端地址。')


if __name__=='__main__': main()
