"""Synthetic, isolated fixtures only; never queries or modifies the original site."""
import copy
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from argparse import Namespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).resolve().parents[1] / 'scripts/export-content.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
AT = datetime(2026, 10, 20, tzinfo=timezone.utc)


def item(id='public-one', status='published', date='2026-10-19T09:00:00+08:00'):
    return dict(id=id, kind='depth', slug=id, status=status, publishedAt=date,
                body='## 正文\n\n完整的公开正文。', title='测试内容', summary='测试摘要',
                topics=['agent'], related=[], people=[], sourceUrl='', cover='')


class VisibilityTests(unittest.TestCase):
    def test_mysql_password_is_never_an_argument_and_query_is_read_only(self):
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'mysql.cnf'
            config.write_text('[client]\nhost=127.0.0.1\nuser=root\npassword=\n')
            config.chmod(0o600)
            result=Namespace(returncode=0,stdout=json.dumps({'database':'huangdao','updatedAt':'2026-10-20 00:00:00','payload':{'contents':[]}}),stderr='')
            with patch.dict(exporter.os.environ,{'DB_PASSWORD':'synthetic-environment-secret'}), patch.object(exporter.shutil,'which',return_value='/mock/mysql'), patch.object(exporter.subprocess,'run',return_value=result) as run:
                exporter.read_mysql(Namespace(mysql_config=config,database='huangdao'))
            args=run.call_args.args[0];options=run.call_args.kwargs
            self.assertIn('--no-defaults',args)
            self.assertFalse(any('synthetic-environment-secret' in x for x in args))
            self.assertEqual(options['env']['MYSQL_PWD'],'synthetic-environment-secret')
            self.assertIn('START TRANSACTION READ ONLY',options['input'])
            self.assertIn('ROLLBACK',options['input'])
            self.assertNotIn('CREATE',options['input'])
            self.assertNotIn('UPDATE ',options['input'])

    def test_inline_and_reference_media_are_copied_but_unused_media_is_not(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source';target=root/'target';target.mkdir();(target/'.private').mkdir()
            upload=source/'backend/data/uploads';upload.mkdir(parents=True)
            for name in ['inline.png','reference.webp','unused.png']:(upload/name).write_bytes(b'isolated image fixture')
            public=item();public['body']='![inline](/uploads/inline.png)\n\n![reference][pic]\n\n[pic]: /uploads/reference.webp'
            state={'contents':[public],'topics':[],'routes':[],'stages':[],'settings':{},'media':[]}
            old_root,old_private=exporter.ROOT,exporter.PRIVATE
            exporter.ROOT,exporter.PRIVATE=target,target/'.private'
            try:
                exporter.export(state,source,{'type':'isolated-test'},AT)
                self.assertEqual({x.name for x in (target/'public/uploads').iterdir()},{'inline.png','reference.webp'})
            finally:exporter.ROOT,exporter.PRIVATE=old_root,old_private

    def test_original_publication_boundary_and_statuses(self):
        for status in ('published', 'scheduled'):
            self.assertIsNone(exporter.reason(item(status=status, date=AT.isoformat()), AT))
            self.assertEqual(exporter.reason(item(status=status, date='2026-10-21T00:00:00Z'), AT), 'future-publication')
        for status in ('draft', 'offline', 'trash'):
            self.assertEqual(exporter.reason(item(status=status), AT), status)
        for date in ('', 'bad', '2026-10-19', '2026-10-19T09:00:00'):
            self.assertEqual(exporter.reason(item(date=date), AT), 'invalid-publishedAt')

    def test_export_removes_every_nonpublic_payload_and_reference(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / 'source'; target = root / 'target'
            source.mkdir(); target.mkdir(); (target / '.private').mkdir()
            old_root, old_private = exporter.ROOT, exporter.PRIVATE
            exporter.ROOT, exporter.PRIVATE = target, target / '.private'
            try:
                public = item(); hidden = item('secret-draft', 'draft')
                public['related'] = [hidden['id']]
                state = dict(contents=[public, hidden, item('secret-future','scheduled','2026-10-21T00:00:00Z')],
                             topics=[dict(slug='agent',name='Agent',count=900)], routes=[], stages=[],
                             settings=dict(brand='测试',heroId=hidden['id'],signalIds=[hidden['id']],
                                           featuredIds=[public['id'],hidden['id']],sidebarIds=[],adminKey='MUST_NOT_LEAK'),
                             media=[dict(url='/uploads/unused-private.png')], adminKey='MUST_NOT_LEAK')
                exporter.export(state, source, {'type':'isolated-test'}, AT)
                text = '\n'.join(p.read_text() for p in (target / 'content').rglob('*.json'))
                for secret in ('secret-draft','secret-future','MUST_NOT_LEAK','unused-private.png'):
                    self.assertNotIn(secret,text)
                result = json.loads((target/'content/site.json').read_text())
                self.assertEqual(result['topics'][0]['count'],1)
                self.assertEqual(result['contents'][0]['body'],'')
                self.assertEqual(result['contents'][0]['related'],[])
                report = json.loads((target/'.private/migration-audit.json').read_text())
                self.assertEqual(len(report['records']),3)
                self.assertEqual(len(report['exclusions']),2)
                self.assertEqual((target/'.private/migration-audit.json').stat().st_mode & 0o777,0o600)
                exporter.export({**state,'contents':[]},source,{'type':'isolated-test'},AT)
                self.assertFalse(list((target/'content/articles').rglob('*.json')))
            finally: exporter.ROOT,exporter.PRIVATE=old_root,old_private

    def test_inventory_keeps_edited_current_and_reports_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder); path=source/'content/bundle';path.mkdir(parents=True)
            original=item(); (path/'manifest.json').write_text(json.dumps({'contents':[original,item('not-imported')]}))
            edited=copy.deepcopy(original);edited['body']='数据库中已改稿'
            report=next(x for x in exporter.inventory(source,{'contents':[edited]}) if x.get('count'))
            self.assertEqual(report['missingFromCurrent'],1)
            self.assertEqual(report['changedFromCurrent'],1)
            self.assertEqual(report['records'][0]['changedFields'],['body'])
            self.assertEqual(report['records'][0]['decision'],'current-database-wins')


if __name__=='__main__': unittest.main()
