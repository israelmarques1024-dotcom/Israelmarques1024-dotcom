#!/usr/bin/env python3
"""Study Bank Engine v5.1 — 100M virtual study records, grades 6–9."""
import argparse, hashlib, json, math, sqlite3
from fractions import Fraction
from pathlib import Path

TOTAL=100_000_000; PER_GRADE=25_000_000
GRADES=(6,7,8,9)
SUBJECTS=("Matemática","Língua Portuguesa","Ciências","História","Geografia","Inglês","Programação")
TOPICS={
6:{"Matemática":["Números naturais","Frações","Decimais","MDC/MMC","Área e perímetro"],"Língua Portuguesa":["Interpretação","Classes gramaticais","Sujeito e predicado","Tempos verbais"],"Ciências":["Células","Ecologia","Estados físicos","Sistema Solar"],"História":["Antiguidade","Egito Antigo","Grécia Antiga","Roma Antiga"],"Geografia":["Cartografia","Paisagem","Relevo","Hidrografia"],"Inglês":["Verb to be","Simple present","Vocabulary","Reading"],"Programação":["Lógica","HTML","CSS","JavaScript básico","Git básico"]},
7:{"Matemática":["Números inteiros","Frações","Porcentagem","Equações do 1º grau","Proporcionalidade","Geometria","Estatística","Probabilidade"],"Língua Portuguesa":["Interpretação","Advérbios","Conjunções","Figuras de linguagem","Tempos verbais"],"Ciências":["Células","Bactérias","Vírus","Ecologia","Força e gravidade","Velocidade média"],"História":["Renascimento","Reforma Protestante","Contrarreforma","Mercantilismo","Expansão marítima","Brasil Colonial"],"Geografia":["População","Urbanização","Migrações","Hidrografia","Recursos naturais"],"Inglês":["Simple present","Simple past","Modal verbs","Vocabulary","Reading"],"Programação":["JavaScript","Arrays","HTML","CSS","Node.js","Express","SQL","Git"]},
8:{"Matemática":["Equações","Sistemas lineares","Expressões algébricas","Potências","Plano cartesiano","Pitágoras","Estatística"],"Língua Portuguesa":["Interpretação","Orações","Conjunções","Coesão","Figuras de linguagem"],"Ciências":["Corpo humano","Energia","Eletricidade","Química introdutória"],"História":["Iluminismo","Revolução Industrial","Independências","Revolução Francesa","Brasil Império"],"Geografia":["Migrações","Economia","Industrialização","Globalização"],"Inglês":["Simple past","Comparatives","Superlatives","Modal verbs","Reading"],"Programação":["JavaScript intermediário","DOM","Node.js","APIs","SQL","Git"]},
9:{"Matemática":["Equação do 2º grau","Função afim","Função quadrática","Pitágoras","Radiciação","Semelhança","Estatística"],"Língua Portuguesa":["Interpretação","Sintaxe","Orações subordinadas","Argumentação","Coesão textual"],"Ciências":["Genética","Átomos","Química","Física","Ecologia","Evolução"],"História":["Primeira Guerra Mundial","Segunda Guerra Mundial","República no Brasil","Guerra Fria","Século XX"],"Geografia":["Globalização","Geopolítica","Clima","Economia mundial","Urbanização"],"Inglês":["Conditionals","Present perfect","Reading","Vocabulary","Writing"],"Programação":["JavaScript avançado","APIs","Backend","SQL","Git","Arquitetura web"]}}

def mix(n,s):
 x=(n^s)&((1<<64)-1); x^=x>>30; x=x*0xbf58476d1ce4e5b9&((1<<64)-1); x^=x>>27; x=x*0x94d049bb133111eb&((1<<64)-1); return x^(x>>31)
def pick(seq,n,s): return seq[mix(n,s)%len(seq)]
def grade(i): return GRADES[i//PER_GRADE]
def local(i): return i%PER_GRADE
def subject(i): return SUBJECTS[local(i)%len(SUBJECTS)]
def topic(i,g,s): return pick(TOPICS[g][s],i,0xA11CE)
def h(s): return hashlib.sha256(s.encode()).hexdigest()
def rec(i,g,s,t,q,a,e,hi): return {"id":i,"grade":g,"subject":s,"topic":t,"question":q,"answer":str(a),"explanation":e,"hint":hi,"difficulty":pick(("easy","medium","hard"),i,0xD1FF),"questionHash":h(q.lower()),"recordHash":h(f"{i}|{q}|{a}"),"generated":True,"source":"study-bank-v5.1"}

def mathq(i,g,n,t):
 a=int(mix(n,11)%997)+2; b=int(mix(n,13)%991)+2
 if "Fraç" in t:
  c=int(mix(n,17)%29)+1; d=int(mix(n,19)%28)+2; f1=Fraction(a%30+1,b%29+2); f2=Fraction(c,d); r=f1+f2; ans=str(r.numerator) if r.denominator==1 else f"{r.numerator}/{r.denominator}"; q=f"Calcule e simplifique {f1.numerator}/{f1.denominator} + {f2.numerator}/{f2.denominator}."; return rec(i,g,"Matemática",t,q,ans,f"O resultado é {ans}.","Use denominador comum.")
 if "Porcentagem" in t:
  v=a%5000+50; p=pick((5,10,15,20,25,30,40,50,75),n,23); ans=v*p/100; q=f"Quanto é {p}% de {v}?"; return rec(i,g,"Matemática",t,q,str(round(ans,2)).replace('.',','),f"{p}/100 × {v} = {ans}.","Divida a porcentagem por 100.")
 if "Equa" in t or "Função" in t or "Sistemas" in t or "Expressões" in t:
  x=int(a%101)-50; k=int(b%11)+2; d=int(mix(n,29)%61)-30; rhs=k*x+d; q=f"Resolva {k}x + ({d}) = {rhs}."; return rec(i,g,"Matemática",t,q,x,f"Isolando x, obtemos {x}.","Faça a mesma operação nos dois lados.")
 if t in ("Geometria","Área e perímetro","Pitágoras","Plano cartesiano","Semelhança"):
  x=a%100+2; y=b%100+2
  if t=="Pitágoras": ans=math.sqrt(x*x+y*y); q=f"Catetos {x} e {y}: qual é a hipotenusa aproximada?"; return rec(i,g,"Matemática",t,q,f"{ans:.2f}".replace('.',','),"Use a²+b²=c².","Aplique Pitágoras.")
  q=f"Qual é a área de um retângulo de {x} cm por {y} cm?"; return rec(i,g,"Matemática",t,q,f"{x*y} cm²",f"A={x}×{y}={x*y}.","Base × altura.")
 if t in ("Estatística","Probabilidade"):
  if t=="Probabilidade": total=a%98+2; fav=b%(total-1)+1; f=Fraction(fav,total); return rec(i,g,"Matemática",t,f"Há {total} resultados e {fav} favoráveis. Qual é a probabilidade?",f"{f.numerator}/{f.denominator}",f"P={fav}/{total}.","Favoráveis ÷ possíveis.")
  vals=[int(mix(n,s)%101) for s in (31,37,41,43,47)]; av=sum(vals)/5; return rec(i,g,"Matemática",t,f"Qual é a média de {vals}?",str(round(av,2)).replace('.',','),"Some e divida por 5.","Média = soma ÷ quantidade.")
 x=int(a%201)-100 if g>6 else a; y=int(b%201)-100 if g>6 else b; op=pick(("+","-","×"),n,53); ans=x+y if op=="+" else x-y if op=="-" else x*y; return rec(i,g,"Matemática",t,f"Calcule {x} {op} ({y}).",ans,f"O resultado é {ans}.","Observe os sinais.")

def portq(i,g,n,t):
 names=("Ana","Bruno","Carla","Diego","Elisa","Felipe"); places=("escola","biblioteca","laboratório","parque","museu"); acts=("estudou","visitou","observou","organizou","pesquisou"); goals=("aprender ciência","ajudar a turma","preparar um trabalho","divulgar um projeto")
 nm=pick(names,n,61); pl=pick(places,n,67); ac=pick(acts,n,71); go=pick(goals,n,73); txt=f"{nm} {ac} no {pl} para {go}. Depois, compartilhou o resultado."
 if "Interpreta" in t or t in ("Coesão","Argumentação","Reading"):
  mode=mix(n,79)%3
  if mode==0:return rec(i,g,"Língua Portuguesa",t,f"Leia: “{txt}” Qual é a finalidade?",go,f"A finalidade é {go}.","Procure a expressão de objetivo.")
  if mode==1:return rec(i,g,"Língua Portuguesa",t,f"Leia: “{txt}” Onde ocorre a ação?",pl,f"O local é {pl}.","Identifique o lugar.")
  return rec(i,g,"Língua Portuguesa",t,f"Leia: “{txt}” Quem realiza a ação?",nm,f"O sujeito é {nm}.","Identifique quem pratica a ação.")
 if "Figura" in t:
  s,f=pick((("A cidade acordou cedo.","personificação"),("Esperei uma eternidade.","hipérbole"),("Seus olhos são estrelas.","metáfora"),("Ele corre como o vento.","comparação")),n,83); return rec(i,g,"Língua Portuguesa",t,f"Qual figura aparece em “{s}”?",f,f"A figura é {f}.","Observe o sentido figurado.")
 if "Conjun" in t or "Orações" in t:
  cj,rel=pick((("porque","causa"),("portanto","conclusão"),("mas","oposição"),("e","adição"),("se","condição")),n,89); return rec(i,g,"Língua Portuguesa",t,f"Em “Ele estudou {cj} queria aprender”, que relação “{cj}” expressa?",rel,f"Expressa {rel}.","Observe a relação entre as orações.")
 return rec(i,g,"Língua Portuguesa",t,f"Na oração “{nm} {ac} no {pl}”, qual é o sujeito?",nm,f"O sujeito é {nm}.","Pergunte quem pratica a ação.")

FACTS={
"Células":("Qual estrutura controla trocas da célula?","Membrana plasmática."),"Bactérias":("Bactérias são procariontes ou eucariontes?","Procariontes."),"Vírus":("Vírus são formados por células?","Não."),"Ecologia":("Qual é o papel dos decompositores?","Decompor matéria orgânica e reciclar nutrientes."),"Genética":("O que é DNA?","Molécula que armazena informação genética."),"Átomos":("O que é um átomo?","Unidade básica da matéria de um elemento químico."),"Eletricidade":("Qual unidade mede corrente elétrica?","ampere (A)"),"Energia":("O que diz a conservação de energia?","A energia não é criada nem destruída, apenas transformada.")}
def sci(i,g,n,t):
 if t in FACTS:q,a=FACTS[t]; return rec(i,g,"Ciências",t,q,a,f"Revisão de {t}.","Associe o conceito à definição.")
 if "Velocidade" in t or t=="Física": d=int(mix(n,97)%5000)+10; tm=int(mix(n,101)%299)+2; v=d/tm; return rec(i,g,"Ciências",t,f"Um móvel percorre {d} m em {tm} s. Qual é a velocidade média?",f"{v:.2f} m/s".replace('.',','),"v=distância/tempo.","Divida distância por tempo.")
 return rec(i,g,"Ciências",t,f"Qual conceito principal é estudado no tópico “{t}”?",t,f"Questão de revisão sobre {t}.","Revise a definição do tópico.")

HFACT={"Renascimento":"movimento cultural ligado ao humanismo e referências clássicas","Reforma Protestante":"movimento religioso do século XVI que contestou práticas da Igreja Católica","Iluminismo":"movimento intelectual que valorizou razão e debate sobre direitos","Revolução Industrial":"expansão da produção mecanizada e do sistema fabril","Primeira Guerra Mundial":"conflito mundial de 1914 a 1918","Segunda Guerra Mundial":"conflito mundial de 1939 a 1945"}
def hist(i,g,n,t):
 a=HFACT.get(t,f"processo histórico relacionado a {t}"); mode=mix(n,103)%2; q=f"O que foi {t}?" if mode==0 else f"A descrição “{a}” corresponde a qual tema?"; ans=a if mode==0 else t; return rec(i,g,"História",t,q,ans,f"Revisão de {t}.","Associe contexto, causa e consequência.")

GFACT={"Cartografia":"estudo e representação do espaço por mapas","Urbanização":"crescimento da população urbana e expansão das cidades","Migrações":"deslocamentos populacionais","Globalização":"intensificação de fluxos e conexões mundiais","Clima":"padrões atmosféricos de longo prazo","Hidrografia":"estudo das águas e redes de drenagem"}
def geo(i,g,n,t):
 if "População" in t: pop=(int(mix(n,107)%500)+1)*10000; ar=(int(mix(n,109)%500)+1)*100; den=pop/ar; return rec(i,g,"Geografia",t,f"Uma região tem {pop} habitantes e {ar} km². Qual é a densidade?",f"{den:.2f} hab/km²".replace('.',','),"Densidade=população/área.","Divida população pela área.")
 a=GFACT.get(t,f"conceito geográfico relacionado a {t}"); return rec(i,g,"Geografia",t,f"O que é {t}?",a,f"Revisão de {t}.","Associe o termo à definição.")

def eng(i,g,n,t):
 if "present" in t.lower(): sb,v=pick((("I","go"),("you","go"),("he","goes"),("she","goes")),n,113); return rec(i,g,"Inglês",t,f"Complete: {sb} ___ to school every day.",v,f"The correct form is {v}.","Check the subject.")
 if "past" in t.lower(): b,p=pick((("go","went"),("see","saw"),("have","had"),("play","played")),n,127); return rec(i,g,"Inglês",t,f"What is the simple-past form of “{b}”?",p,f"The past form is {p}.","Regular or irregular?")
 if "Vocabulary" in t: en,pt=pick((("school","escola"),("book","livro"),("computer","computador"),("water","água"),("science","ciência")),n,131); return rec(i,g,"Inglês",t,f"What is the Portuguese meaning of “{en}”?",pt,f"{en} means {pt}.","Recall the translation.")
 return rec(i,g,"Inglês",t,f"Which English topic is being reviewed: “{t}”?",t,f"This item reviews {t}.","Use the topic label.")

def prog(i,g,n,t):
 if "JavaScript" in t or t=="Lógica": a=int(mix(n,137)%201)-100;b=int(mix(n,139)%201)-100;op=pick(("+","-","*"),n,149);ans=a+b if op=="+" else a-b if op=="-" else a*b;return rec(i,g,"Programação",t,f"Em JavaScript, qual é o valor de `{a} {op} {b}`?",ans,f"Resultado: {ans}.","Avalie o operador.")
 if t=="HTML": tag,me=pick((("h1","título principal"),("p","parágrafo"),("a","link"),("button","botão")),n,151); return rec(i,g,"Programação",t,f"Qual elemento HTML representa {me}?",f"<{tag}>",f"<{tag}> representa {me}.","Pense em HTML semântico.")
 if t=="CSS": p,me=pick((("color","cor do texto"),("padding","espaço interno"),("margin","espaço externo"),("display","modo de layout")),n,157); return rec(i,g,"Programação",t,f"Qual propriedade CSS controla {me}?",p,f"{p} controla {me}.","Lembre as propriedades básicas.")
 if t=="SQL": cmd,me=pick((("SELECT","consulta"),("INSERT","inserção"),("UPDATE","atualização"),("DELETE","remoção")),n,163); return rec(i,g,"Programação",t,f"Qual comando SQL é associado a {me}?",cmd,f"{cmd} é usado para {me}.","Associe comando e ação.")
 if "Git" in t:return rec(i,g,"Programação",t,"Qual comando mostra o estado do repositório Git?","git status","git status mostra o estado do repositório.","Pense em status.")
 return rec(i,g,"Programação",t,f"Qual área de programação está sendo revisada: {t}?",t,f"Revisão de {t}.","Use o tópico.")

GEN={"Matemática":mathq,"Língua Portuguesa":portq,"Ciências":sci,"História":hist,"Geografia":geo,"Inglês":eng,"Programação":prog}
def generate(i):
 if not 0<=i<TOTAL: raise ValueError("id fora de 0..99.999.999")
 g=grade(i); s=subject(i); t=topic(i,g,s); return GEN[s](i,g,local(i),t)
def filtered(grade_=None,subject_=None,start=0,count=1000):
 got=0;i=max(0,start)
 while i<TOTAL and got<count:
  if (grade_ is None or grade(i)==grade_) and (subject_ is None or subject(i)==subject_): yield i;got+=1
  i+=1
def export(ids,path,fmt="jsonl"):
 p=Path(path)
 if fmt=="json": p.write_text(json.dumps([generate(i) for i in ids],ensure_ascii=False,indent=2),encoding="utf-8")
 else:
  with p.open("w",encoding="utf-8") as f:
   for i in ids:f.write(json.dumps(generate(i),ensure_ascii=False,separators=(",",":"))+"\n")
 return p
def to_sqlite(ids,path):
 db=sqlite3.connect(path);db.execute("CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY,grade INTEGER,subject TEXT,topic TEXT,question TEXT,answer TEXT,explanation TEXT,hint TEXT,question_hash TEXT)");db.execute("CREATE INDEX IF NOT EXISTS idx_grade_subject ON records(grade,subject)")
 for i in ids:
  r=generate(i);db.execute("INSERT OR REPLACE INTO records VALUES(?,?,?,?,?,?,?,?,?)",(r['id'],r['grade'],r['subject'],r['topic'],r['question'],r['answer'],r['explanation'],r['hint'],r['questionHash']))
 db.commit();db.close()
def catalog():return {"version":"5.1.0","totalVirtualRecords":TOTAL,"grades":GRADES,"recordsPerGrade":PER_GRADE,"subjects":SUBJECTS,"topics":TOPICS,"purpose":"banco virtual de estudo original"}
def validate(n=10000):
 uniq=set()
 for i in range(n):
  r=generate(i);assert r==generate(i);assert len(r['questionHash'])==64;uniq.add(r['questionHash'])
 return {"validated":n,"deterministic":True,"uniqueQuestionHashes":len(uniq)}
def main():
 p=argparse.ArgumentParser();p.add_argument("--id",type=int);p.add_argument("--catalog",action="store_true");p.add_argument("--validate",type=int);p.add_argument("--grade",type=int,choices=GRADES);p.add_argument("--subject",choices=SUBJECTS);p.add_argument("--start",type=int,default=0);p.add_argument("--count",type=int);p.add_argument("--output");p.add_argument("--format",choices=("jsonl","json"),default="jsonl");p.add_argument("--sqlite")
 a=p.parse_args()
 if a.catalog:print(json.dumps(catalog(),ensure_ascii=False,indent=2));return
 if a.validate:print(json.dumps(validate(a.validate),ensure_ascii=False,indent=2));return
 if a.id is not None:print(json.dumps(generate(a.id),ensure_ascii=False,indent=2));return
 if a.count is None:p.error("use --id, --catalog, --validate ou --count")
 ids=list(filtered(a.grade,a.subject,a.start,a.count))
 if a.sqlite:to_sqlite(ids,a.sqlite);print(a.sqlite);return
 if not a.output:p.error("--output é obrigatório")
 print(export(ids,a.output,a.format))
if __name__=="__main__":main()
