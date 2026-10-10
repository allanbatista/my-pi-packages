#!/usr/bin/env python3
"""Prepara e registra julgamentos consultivos com orçamento de chamadas."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import jev

CATALOG = Path(__file__).resolve().parent.parent / 'references/workflow-checks.json'


def prepare(case):
    jev.require(isinstance(case, dict), 'Caso deve ser objeto.')
    jev.require({'checks', 'state', 'evidence_refs'} <= set(case) <= {'checks', 'state', 'evidence_refs', 'model'}, 'Caso exige checks, state e evidence_refs.')
    ids, state, refs = case['checks'], case['state'], case['evidence_refs']
    jev.require(isinstance(ids, list) and 0 < len(ids) <= 6 and all(isinstance(x,str) for x in ids) and len(set(ids)) == len(ids), 'Escolha 1–6 checks distintos.')
    jev.require(isinstance(state, dict) and bool(state), 'state deve ser objeto não vazio.')
    jev.require(isinstance(refs, list) and bool(refs) and all(isinstance(x, str) and x.strip() for x in refs), 'Referências de evidência obrigatórias.')
    catalog = jev.parse_json(CATALOG.read_bytes())
    questions = {}
    for key in ids:
        jev.require(isinstance(key, str) and key in catalog['checks'], 'Check desconhecido.')
        check = catalog['checks'][key]
        jev.require(all(jev.content(state.get(field)) for field in check['required_evidence']), 'Evidência mínima ausente/vazia.')
        questions[key] = check['question']
    payload = {'model': case.get('model',jev.DEFAULT_MODEL), 'state': state, 'questions': questions}
    jev.validate_request(payload)
    return catalog, payload


def reserve(connection, max_calls, known_cost_limit, fingerprint, metadata):
    connection.execute('CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL, record TEXT NOT NULL, cost REAL)')
    connection.execute('CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id=1), max_calls INTEGER NOT NULL, known_cost_limit REAL NOT NULL)')
    connection.execute('BEGIN IMMEDIATE')
    try:
        connection.execute('INSERT OR IGNORE INTO budget VALUES (1,?,?)',(max_calls,known_cost_limit))
        jev.require(connection.execute('SELECT max_calls,known_cost_limit FROM budget').fetchone() == (max_calls,known_cost_limit), 'Orçamento persistido não pode ser alterado.')
        count, cost = connection.execute('SELECT COUNT(*), COALESCE(SUM(cost),0) FROM attempts').fetchone()
        jev.require(count < max_calls, 'Orçamento de chamadas esgotado (inclui falhas/timeouts).')
        jev.require(cost < known_cost_limit, 'Limite de custo conhecido atingido.')
        jev.require(not connection.execute('SELECT 1 FROM attempts WHERE fingerprint=?', (fingerprint,)).fetchone(), 'Caso idêntico já consultado; não repita para obter aprovação.')
        cursor = connection.execute('INSERT INTO attempts(fingerprint,record) VALUES (?,?)', (fingerprint,json.dumps(metadata,ensure_ascii=False)))
        connection.commit()
        return cursor.lastrowid
    except Exception:
        connection.rollback()
        raise


def run(case, ledger, max_calls, known_cost_limit, timeout, key, submit=jev.submit):
    catalog, payload = prepare(case)
    jev.require(type(max_calls) is int and 0 < max_calls <= 20, 'max-calls deve ser 1–20.')
    jev.require(jev.number(known_cost_limit,0,float('inf')) and known_cost_limit > 0, 'Limite de custo deve ser positivo e finito.')
    jev.require(jev.number(timeout,0,float('inf')) and timeout > 0, 'Timeout deve ser positivo e finito.')
    jev.require(bool(key), 'OPENROUTER_API_KEY ausente.')
    fingerprint = hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    record = {'catalog_version':catalog['version'], 'request_hash':fingerprint, 'requested_model':payload['model'], 'questions':payload['questions'], 'evidence_refs':case['evidence_refs'], 'result':'unavailable', 'followup':'Revisar fontes; nenhuma promoção de status.', 'cost':None}
    with sqlite3.connect(ledger, timeout=10, isolation_level=None) as connection:
        attempt = reserve(connection,max_calls,known_cost_limit,fingerprint,record)
        try:
            response = submit(payload,key,timeout)
            jev.validate_response(response,payload['questions'])
            record.update(result='consultative', response=response, cost=response['usage']['cost'])
        finally:
            connection.execute('UPDATE attempts SET record=?,cost=? WHERE id=?',(json.dumps(record,ensure_ascii=False),record['cost'],attempt))
    return record


def main():
    parser=argparse.ArgumentParser(description='Checks consultivos JEV; sem efeitos no workflow.')
    parser.add_argument('--case',required=True)
    parser.add_argument('--prepare-only',action='store_true')
    parser.add_argument('--ledger',help='SQLite dentro do write set autorizado; mesmo arquivo em toda a tarefa.')
    parser.add_argument('--max-calls',type=int,default=1)
    parser.add_argument('--known-cost-limit',type=float,default=0.01)
    parser.add_argument('--timeout',type=float,default=60)
    parser.add_argument('--sanitized',action='store_true',help='Confirma revisão humana/agente de dados e referências sem segredos.')
    args=parser.parse_args()
    try:
        case=jev.parse_json(sys.stdin.buffer.read() if args.case == '-' else Path(args.case).read_bytes())
        if args.prepare_only:
            _,result=prepare(case)
        else:
            jev.require(args.sanitized and args.ledger, 'Revise/sanitize o caso e informe --sanitized e --ledger autorizado.')
            result=run(case,args.ledger,args.max_calls,args.known_cost_limit,args.timeout,os.environ.get('OPENROUTER_API_KEY','').strip())
        print(json.dumps(result,ensure_ascii=False,indent=2))
        return 0
    except (ValueError,OSError,sqlite3.Error,TypeError) as error:
        print('Erro: '+(str(error) if isinstance(error,ValueError) else 'Falha local; consulta indisponível.'),file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
