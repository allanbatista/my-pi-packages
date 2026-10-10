import concurrent.futures
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import workflow

CASE={'checks':['claim_support'],'state':{'claim':'Arquivo contém ok.','evidence':'Leitura observou ok.'},'evidence_refs':['fixture:E1']}

class WorkflowTests(unittest.TestCase):
    def test_cases_and_empty(self):
        for fixture in json.loads((workflow.CATALOG.parent/'workflow-cases.json').read_text()):
            workflow.prepare(fixture['case'])
        for value in (None,{},dict(CASE,state={}),dict(CASE,checks=[None]),dict(CASE,checks=['unknown']),dict(CASE,evidence_refs=[]),dict(CASE,state={'claim':None,'evidence':'x'})):
            with self.assertRaises(ValueError): workflow.prepare(value)
        self.assertEqual(workflow.prepare(dict(CASE,model='typesafe/jev-1.13'))[1]['model'],'typesafe/jev-1.13')
    def test_failure_consumes_and_sanitizes(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger=str(Path(directory)/'ledger.sqlite')
            def fail(*args): raise ValueError('remote-secret')
            with self.assertRaises(ValueError): workflow.run(CASE,ledger,1,.01,1,'key',fail)
            with sqlite3.connect(ledger) as connection:
                record=connection.execute('SELECT record FROM attempts').fetchone()[0]
                self.assertNotIn('remote-secret',record)
                self.assertNotIn('Leitura observou',record)
            with self.assertRaisesRegex(ValueError,'esgotado'): workflow.run(CASE,ledger,1,.01,1,'key',fail)
    def test_atomic_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger=str(Path(directory)/'ledger.sqlite')
            with sqlite3.connect(ledger,isolation_level=None) as c: c.execute('CREATE TABLE attempts(id INTEGER PRIMARY KEY,fingerprint TEXT NOT NULL,record TEXT NOT NULL,cost REAL)')
            def reserve(index):
                with sqlite3.connect(ledger,timeout=10,isolation_level=None) as c:
                    try: workflow.reserve(c,1,.01,str(index),{}); return True
                    except ValueError: return False
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                self.assertEqual(sum(pool.map(reserve,range(4))),1)
    def test_success_record_and_immutable_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger=str(Path(directory)/'ledger.sqlite')
            def submit(payload,key,timeout):
                return {'id':'fixture-id','model':'typesafe/jev-1.13-snapshot','usage':{'input_tokens':1,'output_tokens':1,'cost':.001},'answers':{'claim_support':{'type':'choice','choice':'supported','probabilities':{'supported':1,'contradicted':0,'insufficient_evidence':0},'confidence':1}}}
            result=workflow.run(CASE,ledger,2,.01,1,'key',submit)
            self.assertEqual(result['result'],'consultative')
            self.assertEqual(result['response']['model'],'typesafe/jev-1.13-snapshot')
            with sqlite3.connect(ledger,isolation_level=None) as c:
                self.assertEqual(c.execute('SELECT cost FROM attempts').fetchone()[0],.001)
                with self.assertRaisesRegex(ValueError,'alterado'): workflow.reserve(c,3,.01,'b',{})
                with self.assertRaisesRegex(ValueError,'alterado'): workflow.reserve(c,2,.02,'b',{})
    def test_invalid_result_and_missing_key(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger=str(Path(directory)/'ledger.sqlite')
            with self.assertRaisesRegex(ValueError,'ausente'): workflow.run(CASE,ledger,1,.01,1,'')
            self.assertFalse(Path(ledger).exists())
            with self.assertRaises(ValueError): workflow.run(CASE,ledger,1,.01,1,'key',lambda *args: {})
            with sqlite3.connect(ledger) as c:
                self.assertIsNone(c.execute('SELECT cost FROM attempts').fetchone()[0])
    def test_limits_and_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            with sqlite3.connect(str(Path(directory)/'ledger.sqlite'),isolation_level=None) as c:
                workflow.reserve(c,3,.01,'a',{})
                with self.assertRaisesRegex(ValueError,'idêntico'): workflow.reserve(c,3,.01,'a',{})
                c.execute('UPDATE attempts SET cost=.02')
                with self.assertRaisesRegex(ValueError,'custo'): workflow.reserve(c,3,.01,'b',{})

if __name__=='__main__': unittest.main()
