/// <reference lib="dom" />
/**
 * WebGL scenes: full-surface fragment shaders driven by time, the pointer and the scroll.
 * Written by the renderer as <canvas data-mz-scene>, started here. Each scene pauses when it is
 * off screen, renders one still frame for people who asked for reduced motion, and keeps its
 * CSS gradient underneath when WebGL is not available.
 */
import type { SceneConfig } from './page.ts'

const HEADER = `precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scroll;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_intensity;
uniform sampler2D u_tex;
uniform sampler2D u_tex2;
uniform vec2 u_texSize;
uniform float u_hover;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.;a*=.5;}return v;}
float grain(){return (hash(gl_FragCoord.xy+fract(u_time)*100.)-.5)*.035;}
vec2 cover(vec2 uv){float ra=u_res.x/u_res.y;float ta=u_texSize.x/max(u_texSize.y,1.);vec2 s=ra>ta?vec2(1.,ta/ra):vec2(ra/ta,1.);return (uv-.5)*s+.5;}
`

/** The scenes, as the body of a fragment shader. `custom` is written by the user. */
export const SCENES: Record<Exclude<SceneConfig['preset'], 'custom' | 'model' | 'shapes'>, string> = {
  grain: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float d=length((uv-u_mouse)*vec2(u_res.x/u_res.y,1.));
  float n=fbm(uv*2.+u_time*.1);
  vec3 col=mix(u_c1,u_c2,smoothstep(0.,1.,uv.y+n*.4*u_intensity-.2+u_scroll*.3));
  col=mix(col,u_c3,smoothstep(.6,0.,d)*.8);
  col+=(hash(gl_FragCoord.xy*1.3+fract(u_time)*80.)-.5)*.12*u_intensity;
  gl_FragColor=vec4(col,1.);}`,
  plasma: `void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y*3.;float t=u_time*.6;
  float v=sin(p.x+t)+sin(p.y*1.3-t)+sin((p.x+p.y)*.7+t*.8)+sin(length(p+(u_mouse-.5)*4.)*2.-t+u_scroll*3.);
  v=v*.25+.5;vec3 col=mix(u_c1,u_c2,smoothstep(.2,.6,v));col=mix(col,u_c3,smoothstep(.55,.95,v)*u_intensity);
  gl_FragColor=vec4(col+grain(),1.);}`,
  tunnel: `void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y+(u_mouse-.5)*.3;float a=atan(p.y,p.x);float r=length(p);
  float t=u_time*.4+u_scroll*2.;vec2 uv=vec2(a/3.14159,.3/max(r,.001)+t);
  float v=smoothstep(.45,.55,fract(uv.y*4.))*.5+fbm(uv*vec2(3.,2.))*.6;
  vec3 col=mix(u_c2,u_c3,v)*smoothstep(0.,.6,r)*u_intensity;col=mix(u_c1,col,clamp(r*2.,0.,1.));
  gl_FragColor=vec4(col+grain(),1.);}`,
  ripples: `void main(){
  vec2 p=gl_FragCoord.xy/u_res.y;vec2 m=u_mouse*vec2(u_res.x/u_res.y,1.);float d=length(p-m);
  float w=sin(d*40.-u_time*3.)*exp(-d*3.)*u_intensity;float w2=sin(length(p-vec2(.3,.7))*30.-u_time*2.+u_scroll*6.)*.3;
  float v=.5+.5*(w+w2*.5);vec3 col=mix(u_c1,u_c2,v);col+=u_c3*pow(max(w,0.),3.)*.6;
  gl_FragColor=vec4(col+grain(),1.);}`,
  lines: `void main(){
  vec2 p=gl_FragCoord.xy/u_res.y*2.;float n=fbm(p+u_time*.05+u_mouse*.5)+u_scroll*.3;
  float l=abs(fract(n*12.)-.5);float line=smoothstep(.06*u_intensity+.01,0.,l);
  vec3 col=mix(u_c1,u_c2,n*.6);col=mix(col,u_c3,line*.9);
  gl_FragColor=vec4(col,1.);}`,
  dots: `void main(){
  float cell=18.;vec2 g=floor(gl_FragCoord.xy/cell);vec2 f=fract(gl_FragCoord.xy/cell)-.5;
  vec2 c=(g+.5)*cell/u_res;float d=length((c-u_mouse)*vec2(u_res.x/u_res.y,1.));
  float s=.12+.3*smoothstep(.35,0.,d)*u_intensity+.05*sin(u_time*1.5+g.x*.4+g.y*.3+u_scroll*6.);
  float dt=smoothstep(s,s-.06,length(f));
  vec3 col=mix(u_c1,mix(u_c2,u_c3,smoothstep(.4,0.,d)),dt);
  gl_FragColor=vec4(col,1.);}`,
  smoke: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv*vec2(u_res.x/u_res.y,1.)*2.;float t=u_time*.15;
  vec2 q=vec2(fbm(p-vec2(0.,t)),fbm(p+vec2(t*.5,-t)));float f=fbm(p+q*2.*u_intensity+(u_mouse-.5)+vec2(0.,u_scroll));
  vec3 col=mix(u_c1,u_c2,f*f*1.6*smoothstep(0.,1.,uv.y+.2));col=mix(col,u_c3,smoothstep(.55,.95,f)*.5);
  gl_FragColor=vec4(col+grain(),1.);}`,
  stars: `void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 col=u_c1;float t=u_time*.12*(1.+u_scroll*2.);
  for(int i=0;i<4;i++){float fi=float(i);float z=fract(t+fi*.25);float sc=mix(18.,.8,z);
    vec2 g=p*sc+(u_mouse-.5)*sc*.2+fi*7.;vec2 id=floor(g);vec2 f=fract(g)-.5;float h=hash(id+fi);
    float d=length(f-(vec2(hash(id+3.),hash(id+5.))-.5)*.7);
    float star=smoothstep(.05*z+.01,0.,d)*step(.55,h)*smoothstep(0.,.3,z)*smoothstep(1.,.8,z);
    col+=mix(u_c2,u_c3,h)*star*1.5*u_intensity;}
  gl_FragColor=vec4(col,1.);}`,
  cells: `void main(){
  vec2 p=gl_FragCoord.xy/u_res.y*5.;float t=u_time*.3+u_scroll*2.;float md=8.;float md2=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 id=floor(p)+g;
    vec2 o=.5+.4*sin(t+6.28*vec2(hash(id),hash(id+9.)));vec2 r=g+o-fract(p);float d=dot(r,r);
    if(d<md){md2=md;md=d;}else if(d<md2){md2=d;}}
  float edge=smoothstep(.02,.08*u_intensity+.02,md2-md);
  vec2 m=u_mouse*vec2(u_res.x/u_res.y,1.)*5.;float glow=smoothstep(2.,0.,length(p-m));
  vec3 col=mix(u_c3,mix(u_c1,u_c2,sqrt(md)),edge);col+=u_c3*glow*.25;
  gl_FragColor=vec4(col,1.);}`,
  silk: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv*vec2(u_res.x/u_res.y,1.);float t=u_time*.25;
  float w=sin(p.x*3.+t+sin(p.y*2.+t*.7)*1.5+u_mouse.x*2.)*.5+.5;
  float w2=sin(p.y*4.-t*1.2+w*3.+u_scroll*3.)*.5+.5;
  float v=mix(w,w2,.5);vec3 col=mix(u_c1,u_c2,v);col+=u_c3*pow(v,6.)*u_intensity*.8;
  gl_FragColor=vec4(col+grain(),1.);}`,
  gradient: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float t=u_time*.15;
  vec2 q=uv+.18*vec2(fbm(uv*2.+t),fbm(uv*2.-t+4.))+(u_mouse-.5)*.12*u_intensity;
  float a=smoothstep(0.,1.,q.x+.25*sin(q.y*3.+t*2.));
  float b=smoothstep(.2,1.,q.y+.25*cos(q.x*2.5-t*1.5)+u_scroll*.3);
  vec3 col=mix(mix(u_c1,u_c2,a),u_c3,b*.85);
  gl_FragColor=vec4(col+grain()*.6,1.);}`,
  globe: `void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y;float R=.42;vec3 col=u_c1;float r=length(p);
  if(r<R){float z=sqrt(R*R-r*r);vec3 n=vec3(p,z)/R;
    float rot=u_time*.2+(u_mouse.x-.5)*2.+u_scroll*3.;float c=cos(rot),s=sin(rot);
    vec3 q=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);float lat=asin(q.y),lon=atan(q.x,q.z);
    vec2 g=vec2(lon,lat)*24./3.1416;vec2 f=fract(g)-.5;
    float land=step(.5,noise(vec2(lon,lat)*2.2+3.));float pt=smoothstep(.24,.12,length(f))*(.3+.7*land);
    vec3 dc=u_c2*(.3+.9*land)+u_c3*land*.2;
    col=mix(u_c1,dc,clamp(pt*(.45+.75*n.z)*u_intensity,0.,1.));col+=u_c2*pow(1.-n.z,3.)*.4;
  }else col+=u_c2*smoothstep(R+.08,R,r)*.25;
  gl_FragColor=vec4(col,1.);}`,
  metaballs: `void main(){
  vec2 p=(gl_FragCoord.xy-.5*u_res)/u_res.y;float t=u_time*.5;float v=0.;
  for(int i=0;i<6;i++){float fi=float(i);vec2 c=.32*vec2(sin(t*.7+fi*1.7),cos(t*.9+fi*2.3+u_scroll*2.));v+=.012/dot(p-c,p-c);}
  vec2 m=(u_mouse-.5)*vec2(u_res.x/u_res.y,1.);v+=.02*u_intensity/max(dot(p-m,p-m),.0001);
  float e=smoothstep(.9,1.,v);float rim=smoothstep(.75,.9,v)-e;
  vec3 col=mix(u_c1,u_c2,e);col=mix(col,u_c3,clamp(rim*.8+e*smoothstep(1.,3.,v)*.5,0.,1.));
  gl_FragColor=vec4(col+grain(),1.);}`,
  ribbons: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float t=u_time*.3;vec3 col=u_c1;
  for(int i=0;i<5;i++){float fi=float(i);
    float y=.5+.18*sin(uv.x*3.+t+fi*1.3)+.08*sin(uv.x*7.-t*1.7+fi)+(u_mouse.y-.5)*.2+(u_scroll-.5)*.2;
    float w=.012+.03*(.5+.5*sin(uv.x*4.+fi+t));float d=abs(uv.y-y-(fi-2.)*.05);
    vec3 k=mix(u_c2,u_c3,fi/4.);col=mix(col,k,smoothstep(w,0.,d)*.85*u_intensity);col+=k*smoothstep(w*6.,0.,d)*.08;}
  gl_FragColor=vec4(col+grain(),1.);}`,
  lens: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float ra=u_res.x/u_res.y;float r=length((uv-u_mouse)*vec2(ra,1.));
  float R=.18*(.6+u_intensity*.4);float k=smoothstep(R,0.,r);
  vec3 col=texture2D(u_tex,cover(u_mouse+(uv-u_mouse)*(1.-.45*k))).rgb;
  float edge=smoothstep(R,R-.012,r)-smoothstep(R-.012,R-.03,r);
  col=mix(col*(1.+.12*k),u_c3,edge*.6);
  gl_FragColor=vec4(col,1.);}`,
  transition: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float n=fbm(uv*4.+u_time*.1);
  float pr=u_hover*1.3-.15;float m=smoothstep(pr-.1,pr+.1,n*.6+uv.y*.4);
  vec2 off=vec2(0.,(1.-m)*m*.15*u_intensity);
  vec3 a=texture2D(u_tex,cover(uv+off)).rgb;vec3 b=texture2D(u_tex2,cover(uv-off)).rgb;
  gl_FragColor=vec4(mix(b,a,m),1.);}`,
  prism: `void main(){
  vec2 p=gl_FragCoord.xy/u_res.y*4.+u_mouse-250.;float t=u_time*.4+u_scroll*2.;vec2 i=p;float c=1.;
  for(int n=0;n<4;n++){float tt=t*(1.-3.5/float(n+1));i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005)));}
  c/=4.;c=1.17-pow(c,1.4);float v=pow(abs(c),8.)*u_intensity;
  vec3 col=mix(u_c1,u_c2,clamp(v*1.4,0.,1.));col=mix(col,u_c3,smoothstep(1.,2.5,v)*.6);
  gl_FragColor=vec4(col,1.);}`,
  halftone: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float ra=u_res.x/u_res.y;
  float cell=mix(14.,5.,smoothstep(.4,0.,length((uv-u_mouse)*vec2(ra,1.))))*(2.-u_intensity*.5);
  vec2 g=floor(gl_FragCoord.xy/cell)*cell+cell*.5;vec3 img=texture2D(u_tex,cover(g/u_res)).rgb;
  float l=dot(img,vec3(.299,.587,.114));float r=length(gl_FragCoord.xy-g)/cell;
  float dt=smoothstep(l*.62,l*.62-.08,r);
  gl_FragColor=vec4(mix(u_c1,mix(u_c2,u_c3,l),dt),1.);}`,
  glitch: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 tuv=cover(uv);float t=floor(u_time*8.);
  float row=floor(uv.y*30.);float band=step(.86,hash(vec2(row,t)))*u_intensity;
  float off=(hash(vec2(t,row))-.5)*.08*band;float sh=.004*u_intensity+length(u_mouse-.5)*.012;
  vec3 col=vec3(texture2D(u_tex,tuv+vec2(off+sh,0.)).r,texture2D(u_tex,tuv+vec2(off,0.)).g,texture2D(u_tex,tuv+vec2(off-sh,0.)).b);
  gl_FragColor=vec4(col+(hash(gl_FragCoord.xy+t)-.5)*.06,1.);}`,
  pixel: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float ra=u_res.x/u_res.y;float d=length((uv-u_mouse)*vec2(ra,1.));
  float px=max(1.,mix(46.,1.,smoothstep(.45,0.,d))*(.5+u_intensity*.5)*(1.-u_scroll*.6));
  vec2 q=floor(gl_FragCoord.xy/px)*px+px*.5;
  gl_FragColor=vec4(texture2D(u_tex,cover(q/u_res)).rgb,1.);}`,
  mesh: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv;p.x*=u_res.x/u_res.y;
  float t=u_time*.15;vec2 m=(u_mouse-.5)*.5*u_intensity;
  float n1=fbm(p*1.2+vec2(t,-t)+m);
  float n2=fbm(p*1.7-vec2(t*.8,t*.6)-m+n1+u_scroll*.6);
  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.8,n1));
  col=mix(col,u_c3,smoothstep(.35,.9,n2));
  gl_FragColor=vec4(col+grain(),1.);}`,
  waves: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float t=u_time*.6;vec3 col=u_c1;
  for(int i=0;i<6;i++){float fi=float(i);
    float y=.18+fi*.12+.07*u_intensity*sin(uv.x*(2.5+fi*.7)+t*(.8+fi*.25)+u_mouse.x*2.)+(u_scroll-.5)*.08*fi;
    float edge=smoothstep(0.,.006,uv.y-y);
    col=mix(col,mix(u_c2,u_c3,fi/5.),edge*.28);}
  gl_FragColor=vec4(col+grain(),1.);}`,
  aurora: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=vec2(uv.x*u_res.x/u_res.y,uv.y);float t=u_time*.2;
  float n=fbm(vec2(p.x*1.5+t,p.y*.6-t*.5)+u_mouse*.3);
  float b1=exp(-pow((uv.y-.58-(n-.5)*.7*u_intensity-u_scroll*.1)*4.,2.));
  float b2=exp(-pow((uv.y-.36-(fbm(p*2.-t)-.5)*.5*u_intensity)*5.,2.));
  vec3 col=u_c1+u_c2*b1*1.1+u_c3*b2*.9;
  gl_FragColor=vec4(col+grain(),1.);}`,
  marble: `void main(){
  vec2 p=gl_FragCoord.xy/u_res.y*1.6;float t=u_time*.08;
  vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p+4.*q+vec2(1.7,9.2)+u_mouse*.6),fbm(p+4.*q+vec2(8.3,2.8)+u_scroll));
  float f=fbm(p+4.*r*u_intensity);
  vec3 col=mix(u_c1,u_c2,clamp(f*f*2.2,0.,1.));
  col=mix(col,u_c3,clamp(length(q)*.9,0.,1.)*.65);
  gl_FragColor=vec4(col+grain(),1.);}`,
  particles: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res.y;vec3 col=u_c1;float t=u_time*.05;
  vec2 mp=u_mouse*vec2(u_res.x/u_res.y,1.);float md=length(uv-mp);float glow=smoothstep(.4,0.,md)*u_intensity;
  for(int l=0;l<3;l++){float fl=float(l);float sc=10.+fl*9.;
    vec2 g=uv*sc+vec2(0.,t*(1.+fl)*3.+u_scroll*4.);vec2 id=floor(g);vec2 f=fract(g)-.5;
    vec2 off=vec2(hash(id),hash(id+7.))-.5;float d=length(f-off*.7);float r=.03+hash(id+3.)*.05;
    float s=smoothstep(r,0.,d)*(.55+.45*sin(u_time*2.+hash(id)*6.28));
    col+=mix(u_c2,u_c3,hash(id+1.))*s*(.7+glow*2.5);}
  gl_FragColor=vec4(col,1.);}`,
  liquid: `void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_res)/u_res.y;float t=u_time*.5;float v=0.;
  for(int i=0;i<5;i++){float fi=float(i);
    vec2 c=.33*vec2(sin(t*(.6+fi*.13)+fi*1.7),cos(t*(.5+fi*.11)+fi*2.3+u_scroll*2.));
    vec2 d=uv-c;v+=.018/(dot(d,d)+.0001);}
  vec2 m=(u_mouse-.5)*vec2(u_res.x/u_res.y,1.);vec2 dm=uv-m;v+=.03*u_intensity/(dot(dm,dm)+.0001);
  float s=smoothstep(.9,1.15,v);
  vec3 col=mix(u_c1,mix(u_c2,u_c3,clamp(uv.y+.5,0.,1.)),s);
  gl_FragColor=vec4(col+grain(),1.);}`,
  distort: `void main(){
  vec2 uv=gl_FragCoord.xy/u_res;float ra=u_res.x/u_res.y;vec2 tuv=cover(uv);
  float t=u_time*.3;float d=length((uv-u_mouse)*vec2(ra,1.));
  float ripple=sin(d*28.-u_time*4.)*exp(-d*5.)*.018*u_intensity;
  vec2 w=vec2(fbm(tuv*3.+t),fbm(tuv*3.-t))-.5;
  tuv+=w*.035*u_intensity+ripple+vec2(0.,(u_scroll-.5)*.06);
  vec3 col=texture2D(u_tex,tuv).rgb;
  float edge=length(w)*u_intensity;col=mix(col,col*u_c2*1.2,edge*.15);
  gl_FragColor=vec4(col,1.);}`,
}

/** Scenes drawn with three.js. */
export const THREE_D = new Set<SceneConfig['preset']>(['model', 'shapes'])

/** Scenes that work on a picture. */
export const IMAGE_SCENES = new Set<SceneConfig['preset']>([
  'distort',
  'halftone',
  'glitch',
  'pixel',
  'lens',
  'transition',
])

/** "#rrggbb", "#rgb" or "rgb(a)(…)" to 0–1 components. */
function rgb(color: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!color) return fallback
  let m = /^#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(color.trim())
  if (m) {
    let h = m[1] as string
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('')
    const n = Number.parseInt(h, 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  m = /rgba?\(([^)]+)\)/i.exec(color)
  if (m) {
    const [r, g, b] = (m[1] as string).split(',').map((x) => Number.parseFloat(x) / 255)
    return [r ?? 0, g ?? 0, b ?? 0]
  }
  return fallback
}

interface Running {
  canvas: HTMLCanvasElement
  /** Where the shared WebGL output is copied: the scene's own canvas is a plain 2D one. */
  ctx: CanvasRenderingContext2D
  program: Program
  colors: [number, number, number][]
  tex: WebGLTexture | null
  /** transition: the picture shown on hover. */
  tex2: WebGLTexture | null
  hover: number
  hoverGoal: number
  cfg: SceneConfig
  visible: boolean
  mouse: [number, number]
  goal: [number, number]
  scroll: number
  start: number
  texSize: [number, number]
}

interface Program {
  program: WebGLProgram
  u: Record<string, WebGLUniformLocation | null>
}

const UNIFORMS = [
  'u_res',
  'u_time',
  'u_mouse',
  'u_scroll',
  'u_c1',
  'u_c2',
  'u_c3',
  'u_intensity',
  'u_tex',
  'u_tex2',
  'u_texSize',
  'u_hover',
]

function compile(gl: WebGLRenderingContext, fragment: string): WebGLProgram | null {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Materialize: shader non valido', gl.getShaderInfoLog(s))
      return null
    }
    return s
  }
  const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}')
  const fs = shader(gl.FRAGMENT_SHADER, HEADER + fragment)
  if (!vs || !fs) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, 'p')
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}

/**
 * One WebGL context for every scene on the page: browsers allow only about sixteen, and a page
 * with many scenes would lose the oldest. Each scene is drawn here in turn and copied to its own
 * (2D) canvas. Programs are compiled once per shader and shared.
 */
interface Shared {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  programs: Map<string, Program | null>
  users: number
}
let shared: Shared | null = null

function acquire(): Shared | null {
  if (shared && !shared.gl.isContextLost()) {
    shared.users++
    return shared
  }
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl', {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  })
  if (!gl) return null
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  shared = { canvas, gl, programs: new Map(), users: 1 }
  return shared
}

function release() {
  if (!shared) return
  shared.users--
  if (shared.users <= 0) {
    shared.gl.getExtension('WEBGL_lose_context')?.loseContext()
    shared = null
  }
}

function programFor(sh: Shared, source: string): Program | null {
  if (!sh.programs.has(source)) {
    const program = compile(sh.gl, source)
    sh.programs.set(
      source,
      program
        ? { program, u: Object.fromEntries(UNIFORMS.map((n) => [n, sh.gl.getUniformLocation(program, n)])) }
        : null,
    )
  }
  return sh.programs.get(source) ?? null
}

export interface SceneOptions {
  /** The element that scrolls (the editor's canvas); the window otherwise. */
  scroller?: HTMLElement
}

export function startScenes(root: ParentNode = document, options: SceneOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const scenes: Running[] = []
  const cleanups: (() => void)[] = []
  let sh: Shared | null = null

  for (const canvas of root.querySelectorAll<HTMLCanvasElement>('canvas[data-mz-scene]')) {
    let cfg: SceneConfig
    try {
      cfg = JSON.parse(canvas.dataset.mzScene ?? '{}') as SceneConfig
    } catch {
      continue
    }
    // 3D scenes use three.js, loaded only when a page has one.
    if (THREE_D.has(cfg.preset)) {
      let stop: (() => void) | null = null
      let cancelled = false
      import('./scene3d.ts')
        .then((m) => {
          if (!cancelled) stop = m.start3D(canvas, cfg, { scroller: options.scroller, reduced })
        })
        .catch((e) => console.warn('Materialize: scena 3D non disponibile', e))
      cleanups.push(() => {
        cancelled = true
        stop?.()
      })
      continue
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    sh ??= acquire()
    if (!sh) break
    const gl = sh.gl
    const source =
      cfg.preset === 'custom'
        ? (cfg.code ?? '')
        : IMAGE_SCENES.has(cfg.preset) && !cfg.image
          ? SCENES.mesh
          : (SCENES[cfg.preset as keyof typeof SCENES] ?? SCENES.mesh)
    const program = programFor(sh, source) ?? programFor(sh, SCENES.mesh)
    if (!program) continue
    const [c1, c2, c3] = cfg.colors ?? []
    const scene: Running = {
      canvas,
      ctx,
      program,
      colors: [rgb(c1, [0.07, 0.07, 0.09]), rgb(c2, [0.24, 0.35, 1]), rgb(c3, [0.9, 0.5, 0.35])],
      tex: null,
      tex2: null,
      hover: 0,
      hoverGoal: 0,
      cfg,
      visible: false,
      mouse: [0.5, 0.5],
      goal: [0.5, 0.5],
      scroll: 0,
      start: performance.now(),
      texSize: [1, 1],
    }
    const loadTexture = (src: string, first: boolean) => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!sh || sh.gl !== gl) return
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        // Any size works without mipmaps.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        if (first) scene.texSize = [img.naturalWidth, img.naturalHeight]
        draw(scene, performance.now())
      }
      img.src = src.startsWith('/media/') ? `${src}@1280.webp` : src
      return tex
    }
    if (IMAGE_SCENES.has(cfg.preset) && cfg.image) {
      scene.tex = loadTexture(cfg.image, true)
      if (cfg.preset === 'transition') {
        scene.tex2 = loadTexture(cfg.image2 || cfg.image, false)
        // The card it sits in (or its container) turns the picture on hover.
        const host = canvas.closest<HTMLElement>('[data-mz-group]') ?? canvas.parentElement
        if (host) {
          const on = () => {
            scene.hoverGoal = 1
            wake()
          }
          const off = () => {
            scene.hoverGoal = 0
            wake()
          }
          host.addEventListener('pointerenter', on)
          host.addEventListener('pointerleave', off)
          cleanups.push(() => {
            host.removeEventListener('pointerenter', on)
            host.removeEventListener('pointerleave', off)
          })
        }
      }
    }
    canvas.dataset.mzReady = ''
    scenes.push(scene)
  }
  const finish = () => {
    for (const c of cleanups) c()
    for (const s of scenes)
      for (const t of [s.tex, s.tex2]) if (t && sh && !sh.gl.isContextLost()) sh.gl.deleteTexture(t)
    if (sh) release()
  }
  if (!scenes.length) return finish

  function draw(s: Running, now: number) {
    if (!sh || sh.gl.isContextLost()) return
    const { gl, canvas: out } = sh
    const dpr = Math.min(1.5, devicePixelRatio || 1)
    const w = Math.max(1, Math.round(s.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(s.canvas.clientHeight * dpr))
    if (s.canvas.width !== w || s.canvas.height !== h) {
      s.canvas.width = w
      s.canvas.height = h
    }
    // The shared canvas grows to the largest scene; each draws in its corner and is copied out.
    if (out.width < w || out.height < h) {
      out.width = Math.max(out.width, w)
      out.height = Math.max(out.height, h)
    }
    gl.viewport(0, 0, w, h)
    const { program, u } = s.program
    gl.useProgram(program)
    s.mouse[0] += (s.goal[0] - s.mouse[0]) * 0.06
    s.mouse[1] += (s.goal[1] - s.mouse[1]) * 0.06
    const r = s.canvas.getBoundingClientRect()
    const vh = options.scroller ? options.scroller.getBoundingClientRect() : { top: 0, height: innerHeight }
    s.scroll = Math.min(1, Math.max(0, (vh.top + vh.height - r.top) / (vh.height + r.height)))
    const speed = s.cfg.speed ?? 1
    gl.uniform2f(u.u_res ?? null, w, h)
    gl.uniform1f(u.u_time ?? null, reduced ? 6 : ((now - s.start) / 1000) * speed)
    gl.uniform2f(u.u_mouse ?? null, s.mouse[0], s.mouse[1])
    gl.uniform1f(u.u_scroll ?? null, s.scroll * (s.cfg.scroll ?? 1))
    gl.uniform3fv(u.u_c1 ?? null, s.colors[0] as number[])
    gl.uniform3fv(u.u_c2 ?? null, s.colors[1] as number[])
    gl.uniform3fv(u.u_c3 ?? null, s.colors[2] as number[])
    gl.uniform1f(u.u_intensity ?? null, s.cfg.intensity ?? 1)
    gl.uniform2f(u.u_texSize ?? null, s.texSize[0], s.texSize[1])
    if (s.tex) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, s.tex)
      gl.uniform1i(u.u_tex ?? null, 0)
    }
    if (s.tex2) {
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, s.tex2)
      gl.uniform1i(u.u_tex2 ?? null, 1)
      gl.activeTexture(gl.TEXTURE0)
    }
    s.hover += (s.hoverGoal - s.hover) * (reduced ? 1 : 0.07)
    gl.uniform1f(u.u_hover ?? null, s.hover)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    // WebGL draws from the bottom-left corner of its canvas.
    s.ctx.drawImage(out, 0, out.height - h, w, h, 0, 0, w, h)
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = scenes.find((x) => x.canvas === e.target)
        if (s) s.visible = e.isIntersecting
      }
      wake()
    },
    { root: options.scroller ?? null, rootMargin: '100px' },
  )
  for (const s of scenes) io.observe(s.canvas)
  cleanups.push(() => io.disconnect())

  const onPointer = (e: PointerEvent) => {
    for (const s of scenes) {
      const r = s.canvas.getBoundingClientRect()
      const react = s.cfg.mouse ?? 1
      const x = (e.clientX - r.left) / r.width
      const y = 1 - (e.clientY - r.top) / r.height
      s.goal = [0.5 + (x - 0.5) * react, 0.5 + (y - 0.5) * react]
    }
  }
  addEventListener('pointermove', onPointer, { passive: true })
  cleanups.push(() => removeEventListener('pointermove', onPointer))

  let frame = 0
  function tick(now: number) {
    frame = 0
    let any = false
    for (const s of scenes)
      if (s.visible) {
        draw(s, now)
        any = true
      }
    const moving = scenes.some((s) => s.visible && Math.abs(s.hoverGoal - s.hover) > 0.002)
    if (any && (!reduced || moving)) frame = requestAnimationFrame(tick)
  }
  function wake() {
    if (!frame) frame = requestAnimationFrame(tick)
  }
  // A still frame straight away, even before the first visibility report.
  for (const s of scenes) draw(s, performance.now())
  wake()

  return () => {
    cancelAnimationFrame(frame)
    finish()
  }
}
