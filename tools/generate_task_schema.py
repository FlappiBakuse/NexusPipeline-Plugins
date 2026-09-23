"""Generate the protocol wire schema; cross-field safety remains enforced by Host validators."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def obj(properties, optional=()):
    return {'type':'object','additionalProperties':False,'properties':properties,'required':[k for k in properties if k not in optional]}
def arr(item, maximum=2048): return {'type':'array','items':item,'maxItems':maximum}
def enum(*values): return {'enum':list(values)}
def ref(name): return {'$ref':'#/$defs/'+name}
text={'type':'string','minLength':1,'maxLength':512}
integer={'type':'integer','minimum':0}
boolean={'type':'boolean'}
nullable=lambda item: {'anyOf':[item,{'type':'null'}]}
defs={}
defs['textRef']={'oneOf':[
    obj({'kind':{'const':'literal'},'value':{'type':'string','maxLength':2048}}),
    obj({'kind':{'const':'plugin'},'key':{'type':'string','pattern':'^[A-Za-z0-9._-]{1,160}$'},
         'args':{'type':'object','maxProperties':16,'additionalProperties':{'type':['string','number','boolean']}},
         'fallback':{'type':'string','maxLength':2048}})]}
defs['selector']=arr({'oneOf':[text,obj({'by':text,'value':{'type':['string','number','boolean']}}),
    obj({'index':integer,'guardKey':text,'guardValue':{'type':['string','number','boolean','array','object']}})]},32)
defs['selector']['minItems']=1
defs['selectionField']=obj({'resourceId':text,'selector':ref('selector'),'purpose':enum('selection','cursor')})
defs['behaviorField']=obj({'resourceId':text,'selector':ref('selector')})
defs['diagnostic']=obj({'code':text,'message':text,'taskId':nullable(text),'reasonText':ref('textRef')},['taskId','reasonText'])
defs['task']=obj({'id':text,'sourceKey':text,'name':text,'parentId':nullable(text),'role':enum('business','technical','cleanup'),
    'enabled':boolean,'order':integer,'countsAsUnit':boolean,'requiredForParent':boolean,'retryUnitId':text,
    'retryRisk':enum('safe','conditional','unsafe','unknown'),'dependencies':arr(text,128),
    'detection':enum('supported','limited','unsupported'),'configRef':nullable(text),'nameText':ref('textRef')},['configRef','nameText'])
defs['configScope']={'oneOf':[obj({'kind':enum('binding','queue')}),obj({'kind':{'const':'task'},'taskId':text})]}
defs['configLocation']={'oneOf':[
    obj({'source':enum('config','resource'),'resourceId':text,'selector':ref('selector')}),
    obj({'source':{'const':'context'},'field':text}),
    obj({'source':{'const':'environment'},'inspectionId':text})]}
defs['configCheck']=obj({'ruleId':text,'evaluation':enum('satisfied','violated','unknown','not_applicable'),
    'severity':enum('info','warning','error'),'executionEffect':enum('none','warn','block'),
    'scope':ref('configScope'),'locations':arr(ref('configLocation'),8),
    'actions':arr(obj({'kind':enum('open_binding_editor','open_script_settings','refresh_plan')}),3),
    'reasonText':ref('textRef')},['reasonText'])
defs['configAssessment']=obj({'schemaVersion':{'const':'1'},'checks':arr(ref('configCheck'),128)})
defs['configAssessment']['properties']['checks']['minItems']=1
defs['discovery']=obj({'protocolVersion':{'const':'0.1.0'},'type':{'const':'discovery'},'coverage':enum('complete','partial','unsupported'),
    'tasks':arr(ref('task'),1024),'diagnostics':arr(ref('diagnostic'),128),
    'selectionFields':arr(ref('selectionField')),'behaviorFields':arr(ref('behaviorField')),
    'configAssessment':ref('configAssessment')},['selectionFields','behaviorFields'])
defs['evidence']=obj({'sourceId':text,'epoch':integer,'sequence':integer,'ruleId':text})
defs['observationItem']=obj({'id':text,'taskId':text,'executionOrdinal':{'type':'integer','minimum':1},
    'status':enum('running','succeeded','failed','skipped','blocked','unknown'),'reasonCode':text,
    'reasonText':ref('textRef'),'evidence':arr(ref('evidence'),8),
    'skipKind':nullable(enum('satisfied','inapplicable'))},['skipKind','reasonText'])
defs['incident']=obj({'id':text,'taskId':nullable(text),'scopeId':text,'executionOrdinal':{'type':'integer','minimum':1},
    'kind':enum('transient_error','business_error','unattributed_error'),
    'resolution':enum('open','recovered','terminal'),'reasonCode':text,
    'reasonText':ref('textRef'),'evidence':arr(ref('evidence'),8)},['reasonText'])
defs['observation']=obj({'protocolVersion':{'const':'0.1.0'},'type':{'const':'observation'},'runId':text,'attemptId':text,
    'observations':arr(ref('observationItem')),'runBoundary':enum('open','ended','aborted','unknown'),
    'boundaryEvidence':arr(ref('evidence'),8),'diagnostics':arr(ref('diagnostic'),128),
    'cursorState':{'type':['object','null']},'incidents':arr(ref('incident'))},['cursorState','incidents'])
selection_text={'type':'string','maxLength':4096}
defs['selectionValue']={'oneOf':[boolean,selection_text,arr({'oneOf':[boolean,selection_text]},1024)]}
defs['operation']=obj({'selector':ref('selector'),'expected':ref('selectionValue'),'value':ref('selectionValue'),'purpose':enum('selection','cursor')})
defs['patch']=obj({'resourceId':text,'format':enum('json','yaml'),'expectedRevision':text,'operations':arr(ref('operation'))})
defs['retry']=obj({'protocolVersion':{'const':'0.1.0'},'type':{'const':'retry'},'decision':enum('stop','selective'),
    'reasonCode':text,'reasonText':ref('textRef'),'includedTaskIds':arr(text,1024),
    'prerequisiteTaskIds':arr(text,1024),'expandedUnitIds':arr(text,1024),
    'filePatches':arr(ref('patch'),32)},['reasonText'])
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:nxp:task-protocol:0.1.0',
    'title':'NexusPipeline task protocol 0.1.0 outputs','oneOf':[ref('discovery'),ref('observation'),ref('retry')],'$defs':defs}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    path=ROOT/'contracts/task-protocol.schema.json';content=json.dumps(schema,ensure_ascii=False,indent=2)+'\n'
    if args.check:
        if not path.is_file() or path.read_text(encoding='utf-8')!=content: raise SystemExit('Task protocol schema differs; run tools/generate_task_schema.py')
    else:
        path.parent.mkdir(exist_ok=True);path.write_text(content,encoding='utf-8',newline='\n')
    print('Task protocol schema checked' if args.check else 'Task protocol schema generated')
if __name__=='__main__': main()
