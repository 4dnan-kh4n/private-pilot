import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = 'C:/Users/mak22/Desktop/swiftRoute';
const SKILL_DIR = 'C:/Users/mak22/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const RUNTIME_PYTHON = 'C:/Users/mak22/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const TMP_DIR = path.join(workspaceDir, '.codex-finalizer');
const FINAL_PPTX = path.join(workspaceDir, 'output', 'PrivatePilot_SIH2026_Deck_v3.pptx');
const ORBS = path.join(workspaceDir, 'assets', 'privatepilot-orbs.png');

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
const orbs = await fs.readFile(ORBS);

const W = 1280, H = 720;
const C = {
  bg: '#F7F6F2', ink: '#0B1714', forest: '#102B25', teal: '#1697A6',
  tealPale: '#DCEFED', burgundy: '#702835', orange: '#C7652D',
  line: '#D9DDD7', muted: '#63716C', paper: '#FCFBF8', pale: '#EEF1EC', white: '#FFFFFF'
};
const serif = 'Georgia';
const sans = 'Aptos';

const p = (slide, x, y, w, h, text, style = {}) => {
  const s = slide.shapes.add({ geometry: 'textbox', position: { left:x, top:y, width:w, height:h }, fill:'none', line:{fill:'none',width:0} });
  s.text = text;
  s.text.style = { typeface: style.typeface ?? sans, fontSize: style.fontSize ?? 18, color: style.color ?? C.ink, bold: style.bold ?? false, italic: style.italic ?? false, alignment: style.alignment ?? 'left', autoFit:'shrinkText' };
  return s;
};
const rect = (slide, x, y, w, h, fill=C.paper, line=C.line, radius='rounded-xl') => slide.shapes.add({ geometry:'roundRect', position:{left:x,top:y,width:w,height:h}, fill, line:{style:'solid',fill:line,width:1}, borderRadius:radius });
const pill = (slide, x, y, w, text, fill=C.forest, color=C.white) => {
  const s = slide.shapes.add({ geometry:'roundRect', position:{left:x,top:y,width:w,height:32}, fill, line:{fill, width:0}, borderRadius:'rounded-full' });
  s.text = text; s.text.style={typeface:sans,fontSize:13,color,bold:true,alignment:'center',autoFit:'shrinkText'}; return s;
};
const line = (slide,x1,y1,x2,y2,color=C.line,width=1) => slide.shapes.add({ geometry:'line', position:{left:x1,top:y1,width:x2-x1,height:y2-y1}, line:{style:'solid',fill:color,width} });
const dot = (slide,x,y,r,fill=C.teal) => slide.shapes.add({geometry:'ellipse',position:{left:x-r,top:y-r,width:r*2,height:r*2},fill,line:{fill,width:0}});
const shield = (slide,x,y,scale=1,color=C.forest) => {
  const outer = slide.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:34*scale,height:38*scale},fill:'none',line:{style:'solid',fill:color,width:2},borderRadius:'rounded-md'});
  const check = p(slide,x+7*scale,y+8*scale,20*scale,20*scale,'✓',{typeface:sans,fontSize:17*scale,color,bold:true,alignment:'center'});
  return [outer,check];
};
const browser = (slide,x,y,w,h, title='Private dashboard') => {
  const box = rect(slide,x,y,w,h,C.white,C.line,'rounded-2xl');
  const bar = slide.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:42},fill:'#F0F1ED',line:{fill:'none',width:0},borderRadius:'rounded-2xl'});
  dot(slide,x+22,y+21,4,C.burgundy); dot(slide,x+36,y+21,4,C.orange); dot(slide,x+50,y+21,4,C.teal);
  p(slide,x+76,y+12,w-96,18,title,{fontSize:13,color:C.muted});
  return box;
};
const note = (slide, lines, sources=[]) => slide.speakerNotes.textFrame.setText([...lines, ...(sources.length?['Sources:',...sources]:[])]);
const header = (slide, section, title, subtitle='') => {
  pill(slide,72,42,section.length*8+62,section.toUpperCase(),C.forest);
  p(slide,72,92,1030,58,title,{typeface:serif,fontSize:42,color:C.ink});
  if(subtitle) p(slide,72,152,1040,28,subtitle,{fontSize:16,color:C.muted});
};
const footer = (slide,n) => { p(slide,1130,676,72,18,String(n).padStart(2,'0'),{fontSize:12,color:C.muted,alignment:'right'}); };

const deck = Presentation.create({slideSize:{width:W,height:H}});

// 1. Title
{
  const s=deck.slides.add(); s.background.fill=C.bg;
  s.images.add({blob:orbs,contentType:'image/png',alt:'Abstract teal and burgundy textured spheres',fit:'cover',position:{left:0,top:0,width:W,height:H}});
  s.shapes.add({geometry:'rect',position:{left:42,top:118,width:620,height:520},fill:C.bg,line:{fill:'none',width:0}});
  pill(s,72,52,192,'PRIVACY FOR BROWSER AI',C.forest);
  shield(s,72,165,1.25,C.forest);
  p(s,124,156,700,94,'PrivatePilot',{typeface:serif,fontSize:72,color:C.ink});
  p(s,76,270,610,42,'A privacy shield for AI-powered browser assistance',{fontSize:24,color:C.forest});
  line(s,76,338,520,338,C.teal,2);
  p(s,76,368,570,60,'As AI assistants work inside browsers, private information visible on a webpage can become part of AI context.',{fontSize:20,color:C.ink});
  p(s,76,552,360,22,'SIH 2026  ·  ISRO',{fontSize:15,color:C.muted,bold:true});
  p(s,76,582,530,28,'SIH26171  ·  On-device Visual Perception for Light-weight Browser Agents',{fontSize:14,color:C.muted});
  note(s,['Open with the problem: browser assistants can use what a signed-in user can see. PrivatePilot is the proposed local privacy layer.'],['SIH26171 problem statement supplied by the presenter.']);
}

// 2. Evolution
{
  const s=deck.slides.add(); s.background.fill=C.bg; header(s,'Context','AI is moving from chat to the browser','Browser assistants can understand the page a user is viewing.'); footer(s,2);
  const stages=[['Chatbots','Answer questions'],['AI copilots','Work beside users'],['AI-first browsers','Understand tabs'],['Browser agents','Act on webpages']];
  const xs=[72,346,620,894];
  stages.forEach(([a,b],i)=>{rect(s,xs[i],214,238,84,i===3?C.forest:C.paper,i===3?C.forest:C.line); p(s,xs[i]+20,231,190,22,a,{fontSize:17,color:i===3?C.white:C.ink,bold:true});p(s,xs[i]+20,257,190,18,b,{fontSize:13,color:i===3?'#DCEFED':C.muted});if(i<3){line(s,xs[i]+238,256,xs[i]+274,256,C.teal,2);dot(s,xs[i]+267,256,4,C.teal);}});
  p(s,72,330,520,24,'Evidence of growing browser-agent adoption',{fontSize:18,bold:true,color:C.forest});
  const table=s.tables.add({rows:5,columns:4,left:72,top:366,width:1136,height:218,values:[
    ['Product','Current availability','Public adoption metric','Source'],
    ['Claude in Chrome','Paid plans and Chrome side-panel beta','Not publicly disclosed','Anthropic'],
    ['Perplexity Comet','Mac, Windows, iOS and Android','Not publicly disclosed','Perplexity'],
    ['ChatGPT browser workflows','Availability varies by product and plan','Not publicly disclosed','OpenAI'],
    ['Google Project Mariner','Research prototype','Not publicly disclosed','Google DeepMind']
  ]});
  table.styleOptions={headerRow:true,bandedRows:true}; table.columnWidths=[235,340,300,261]; table.borders.assign({style:'solid',fill:C.line,width:1});
  table.cells.block({row:0,column:0,rowCount:1,columnCount:4}).assign({fill:C.forest,textStyle:{typeface:sans,fontSize:13,bold:true,color:C.white}});
  table.cells.block({row:1,column:0,rowCount:4,columnCount:4}).assign({fill:C.paper,textStyle:{typeface:sans,fontSize:12,color:C.ink}});
  p(s,72,616,930,24,'Useful assistants read page context. PrivatePilot focuses on the privacy of that context.',{fontSize:17,color:C.forest,bold:true});
  note(s,['Explain the shift from chat to page-aware browser assistance. The table deliberately reports only public, verifiable availability facts.'],[
    'Claude in Chrome: https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome',
    'Perplexity Comet: https://www.perplexity.ai/help-center/en/articles/11172798-getting-started-with-comet',
    'OpenAI ChatGPT agent: https://help.openai.com/en/articles/11752874',
    'Google Project Mariner: https://blog.google/technology/google-deepmind/project-mariner/'
  ]);
}

// 3. Live demo 1
{
  const s=deck.slides.add();s.background.fill=C.bg;header(s,'Live demo','Helpful browser AI','A browser assistant can work with the active page without manual copy and paste.');footer(s,3);
  browser(s,72,210,774,398,'A long public article');
  p(s,110,278,620,34,'How AI browsers are changing research',{typeface:serif,fontSize:28,color:C.ink});
  [0,1,2,3,4,5].forEach(i=>line(s,110,340+i*29,740-(i%2)*70,340+i*29,C.line,2));
  rect(s,876,210,332,398,C.forest,C.forest,'rounded-2xl');
  p(s,908,248,210,20,'COMET ASSISTANT',{fontSize:12,color:'#B8D6D1',bold:true});
  p(s,908,301,246,76,'Summarise this page in three points.',{typeface:serif,fontSize:26,color:C.white});
  p(s,908,405,236,52,'The assistant reads the active article and returns a short summary.',{fontSize:15,color:'#DCEFED'});
  pill(s,908,530,186,'ASK COMET',C.white,C.forest);
  pill(s,72,628,155,'LIVE DEMONSTRATION',C.teal);
  p(s,254,632,780,20,'Open Comet, visit a long public article, then ask for a three-point summary.',{fontSize:15,color:C.muted});
  note(s,['Switch to Comet. Visit a public article and ask the assistant to summarise the page. Return to this slide after the live response.'],['Perplexity Comet overview: https://www.perplexity.ai/comet']);
}

// 4. Privacy exposure
{
  const s=deck.slides.add();s.background.fill=C.bg;header(s,'Live demo','When helpful context becomes sensitive context','The demonstration uses an authenticated dashboard and fictional data only.');footer(s,4);
  browser(s,72,206,590,410,'PrivatePilot Testing · Private dashboard');
  p(s,108,272,300,28,'Your profile',{typeface:serif,fontSize:27,color:C.ink});
  [['Full name','Aarav Demo'],['Age','26'],['Demo account number','123456789012']].forEach((r,i)=>{p(s,108,331+i*59,190,18,r[0],{fontSize:13,color:C.muted});rect(s,300,321+i*59,300,35,i===2?'#F8EDEF':C.paper,i===2?C.burgundy:C.line,'rounded-md');p(s,315,330+i*59,250,18,r[1],{fontSize:14,color:i===2?C.burgundy:C.ink,bold:i===2});});
  p(s,108,513,260,18,'Why should we hire you?',{fontSize:13,color:C.muted});rect(s,108,542,492,44,C.paper,C.line,'rounded-md');p(s,122,556,420,16,'I enjoy solving real problems with thoughtful technology.',{fontSize:13,color:C.muted});
  line(s,675,410,748,410,C.teal,2);dot(s,735,410,5,C.teal);
  rect(s,778,237,430,347,C.paper,C.line,'rounded-2xl');p(s,814,270,260,18,'BROWSER AI ASSISTANT',{fontSize:12,color:C.muted,bold:true});p(s,814,318,324,52,'Help me answer “Why should we hire you?”',{typeface:serif,fontSize:25,color:C.ink});p(s,814,398,326,76,'When the assistant receives active-page access, the visible profile can become part of its context.',{fontSize:17,color:C.forest});
  pill(s,814,506,230,'ACTIVE PAGE ACCESS',C.burgundy);
  p(s,72,642,1120,22,'Demo flow: sign in  •  ask for writing help  •  ask “What name is visible on this page?”',{fontSize:15,color:C.muted,alignment:'center'});
  note(s,['Register using dummy data, sign in, and ask the browser assistant to help answer the application question. Then ask which name is visible. State clearly: the assistant did not hack the database. It read the signed-in page after the user gave it access.'],['Demo website: https://private-pilot-testing.vercel.app/']);
}

// 5. Solution
{
  const s=deck.slides.add();s.background.fill=C.bg;header(s,'Proposed solution','PrivatePilot: privacy before AI reasoning','Local analysis creates a safe page representation before cloud reasoning begins.');footer(s,5);
  const labels=['Logged-in\nwebpage','Local PII\ndetection','Redaction and\nreplacement','Safe context\nto cloud AI','Helpful AI\nresponse']; const x=[72,292,512,732,952]; const boxes=[];
  labels.forEach((t,i)=>{boxes.push(rect(s,x[i],238,180,104,i===2?C.forest:C.paper,i===2?C.forest:C.line,'rounded-2xl'));p(s,x[i]+16,268,148,52,t,{fontSize:17,color:i===2?C.white:C.ink,bold:true,alignment:'center'});if(i<4){line(s,x[i]+180,290,x[i]+220,290,C.teal,2);dot(s,x[i]+212,290,4,C.teal);}});
  p(s,72,390,250,22,'Before local protection',{fontSize:16,color:C.muted,bold:true});p(s,72,424,365,60,'Name: Adnan Khan\nAccount: 123456789012',{typeface:sans,fontSize:19,color:C.burgundy,bold:true});
  rect(s,470,402,250,92,C.tealPale,C.teal,'rounded-2xl');shield(s,500,428,.85,C.forest);p(s,544,422,145,20,'LOCAL REDACTION',{fontSize:13,color:C.forest,bold:true});p(s,544,447,150,20,'TLS encrypted channel',{fontSize:12,color:C.muted});
  p(s,784,390,250,22,'Safe AI context',{fontSize:16,color:C.muted,bold:true});p(s,784,424,365,60,'Name: PERSON_1\nAccount: ACCOUNT_1',{typeface:sans,fontSize:19,color:C.forest,bold:true});
  p(s,72,572,1120,40,'PrivatePilot preserves AI usefulness while personal values remain inside the browser.',{typeface:serif,fontSize:28,color:C.ink,alignment:'center'});
  note(s,['Walk through the proposed architecture. PrivatePilot detects sensitive content locally, replaces identifiers with placeholders, then sends only safe context for external reasoning. Encryption protects the channel; redaction protects the content.']);
}

// 6. Existing approaches
{
  const s=deck.slides.add();s.background.fill=C.bg;header(s,'Landscape','Current controls do not solve the complete problem','Existing controls address parts of the risk. PrivatePilot focuses on the page context itself.');footer(s,6);
  const table=s.tables.add({rows:5,columns:3,left:72,top:220,width:1136,height:285,values:[
    ['Approach','What it protects','Limitation'],
    ['Browser privacy settings','Cookies, camera, and location','Do not redact page content before AI analysis'],
    ['AI-provider safety controls','Some sensitive-site safeguards','Depend on each AI provider'],
    ['Enterprise DLP tools','Organisation-level data controls','Often do not target dynamic browser-agent context'],
    ['PrivatePilot','Local detection and redaction before AI receives context','Proposed lightweight browser-agent privacy layer']
  ]});
  table.styleOptions={headerRow:true,bandedRows:true};table.columnWidths=[270,355,511];table.borders.assign({style:'solid',fill:C.line,width:1});
  table.cells.block({row:0,column:0,rowCount:1,columnCount:3}).assign({fill:C.forest,textStyle:{typeface:sans,fontSize:14,bold:true,color:C.white}});
  table.cells.block({row:1,column:0,rowCount:3,columnCount:3}).assign({fill:C.paper,textStyle:{typeface:sans,fontSize:14,color:C.ink}});
  table.cells.block({row:4,column:0,rowCount:1,columnCount:3}).assign({fill:C.tealPale,textStyle:{typeface:sans,fontSize:14,color:C.forest,bold:true}});
  p(s,116,560,1048,64,'Existing protections are fragmented.\nPrivatePilot focuses on dynamic private data visible to browser AI agents.',{typeface:serif,fontSize:22,color:C.ink,alignment:'center'});
  note(s,['Do not claim that no other solution exists. Explain the gap: browser settings, provider safeguards, and DLP tools cover different parts of the problem. PrivatePilot proposes a lightweight local layer for the AI context.'],[
    'OpenAI browser page visibility settings: https://help.openai.com/en/articles/12625059-web-browsing-settings-on-chatgpt-atlas',
    'Claude in Chrome safety information: https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome'
  ]);
}

// 7. Closing
{
  const s=deck.slides.add();s.background.fill=C.bg;
  s.images.add({blob:orbs,contentType:'image/png',alt:'Abstract teal and burgundy textured spheres',fit:'cover',position:{left:0,top:0,width:W,height:H}});
  s.shapes.add({geometry:'rect',position:{left:42,top:92,width:640,height:490},fill:C.bg,line:{fill:'none',width:0}});
  shield(s,76,116,1.15,C.forest);
  p(s,76,188,690,84,'PrivatePilot',{typeface:serif,fontSize:70,color:C.ink});
  p(s,78,286,700,40,'Helpful AI should not require exposing private context.',{fontSize:24,color:C.forest});
  line(s,78,354,472,354,C.teal,2);
  p(s,78,408,560,72,'Thank You',{typeface:serif,fontSize:54,color:C.ink});
  pill(s,78,510,152,'QUESTIONS?',C.forest);
  note(s,['Close by returning to the central principle: people should be able to use browser AI without needlessly exposing their private context.']);
}

await fs.mkdir(TMP_DIR,{recursive:true});await fs.mkdir(path.dirname(FINAL_PPTX),{recursive:true});
const candidatePath=path.join(TMP_DIR,'privatepilot-candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidatePath);
const requirements={explicitTotalSlideCount:7,requiredNativeTableOwnerSlides:[2,6],requiredNativeChartOwnerSlides:[]};
const fontPolicy={basis:'design',families:[serif,sans]};
const result=await finalizePresentation({
  ...requirements,workspaceDir,candidatePath,finalPath:FINAL_PPTX,pythonExecutable:RUNTIME_PYTHON,
  integrityValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','2','--require-native-table-slide','6'],
  fontPolicy,verifyArtifactToolImport:true,receiptPath:path.join(TMP_DIR,'PrivatePilot_SIH2026_Deck.validation.json')
});
console.log(JSON.stringify({finalPath:FINAL_PPTX,result},null,2));
