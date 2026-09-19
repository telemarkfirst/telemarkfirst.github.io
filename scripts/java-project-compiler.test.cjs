const assert = require('node:assert/strict');
const java = require('../static/simulator/telemark-java.js');
const main = `package robot;
import robot.mechanisms.Lift;
public class Robot extends OpMode {
  Lift lift = new Lift();
  double result;
  public void init() { lift.init(hardwareMap); }
  public void loop() { lift.move(gamepad1.left_stick_y); result = lift.getPower(); }
}`;
const helper = `package robot.mechanisms;
import robot.config.Names;
public class Lift {
  private DcMotor motor;
  public void init(HardwareMap hw) { motor = hw.get(DcMotor.class, Names.MOTOR); }
  public void move(double power) { motor.setPower(power); }
  public double getPower() { return motor.getPower(); }
}`;
const config = 'package robot.config; public class Names { public static final String MOTOR = "lift"; }';
const files = [{name:'Robot.java',source:main},{name:'Lift.java',source:helper},{name:'Names.java',source:config}];
function compile(list = files, options = {}) {
  return java.compileProject(list, java.createRuntime({gamepad1:{left_stick_y:0.6}}), options);
}
function run(program) {
  assert.equal(program.ok, true, JSON.stringify(program.diagnostics));
  program.methods.init?.(); program.methods.loop?.(); return program;
}
assert.equal(run(compile()).scope.result, 0.6);
assert.equal(run(java.compile(java.serializeProject(files), java.createRuntime({gamepad1:{left_stick_y:0.6}}))).scope.result, 0.6);
for(const [label, list, pattern] of [
  ['missing import', [{...files[0],source:main.replace('import robot.mechanisms.Lift;', '')},...files.slice(1)], /import robot.mechanisms.Lift/],
  ['wrong import', [{...files[0],source:main.replace('robot.mechanisms.Lift;', 'robot.missing.Lift;')},...files.slice(1)], /cannot be resolved/],
  ['import is file scoped', [files[0], {...files[1],source:helper.replace('import robot.config.Names;', '')}, files[2]], /import robot.config.Names/],
  ['not public', [files[0],{...files[1],source:helper.replace('public class Lift','class Lift')},files[2]], /public/],
  ['public filename mismatch', [{name:'Wrong.java',source:main},...files.slice(1)], /Robot.java/],
  ['duplicate class', [...files,{name:'other/Names.java',source:config}], /Duplicate class/],
]) {
  const p=compile(list); assert.equal(p.ok,false,label); assert.match(p.diagnostics[0].message,pattern,label); assert.ok(p.diagnostics[0].file,label);
}
const wildcard = [{...files[0],source:main.replace('robot.mechanisms.Lift;', 'robot.mechanisms.*;')},...files.slice(1)];
assert.equal(run(compile(wildcard)).scope.result,0.6);
const qualified = [{...files[0],source:main.replace('import robot.mechanisms.Lift;', '').replaceAll('Lift','robot.mechanisms.Lift')},...files.slice(1)];
assert.equal(run(compile(qualified)).scope.result,0.6);
const samePackage = files.map(f=>({...f,source:f.source.replaceAll('package robot.mechanisms;','package robot;').replaceAll('package robot.config;','package robot;').replace(/import robot\.[^;]+;/g,'')}));
assert.equal(run(compile(samePackage)).scope.result,0.6,'same package needs no import');
const p=java.compile(`public class Main extends OpMode {
 Helper h=new Helper(); int result; public void init(){h.bump();} public void loop(){Helper second=new Helper();second.bump();result=second.count();}
} class Helper {static int total=0; void bump(){total++;} int count(){return total;} }`);
run(p); assert.equal(p.scope.result,2);p.methods.loop();assert.equal(p.scope.result,3,'static fields survive lifecycle calls');
const shadow=java.compile(`class Lift {double power; void set(double power){this.power=power;} double get(){return power;} } public class Main extends OpMode {Lift lift=new Lift();double result;void loop(){lift.set(0.4);result=lift.get();}}`);
assert.equal(run(shadow).scope.result,0.4,'a parameter may have the same name as a field');
const overload=java.compile(`class Helper {int pick(int x){return 1;}int pick(String x){return 2;}int pick(){return 3;}} public class Main extends OpMode {Helper h=new Helper();int result;void loop(){result=h.pick(7)+h.pick("x")+h.pick();}}`);
assert.equal(run(overload).scope.result,6,'helper overload dispatch uses argument count and distinguishable types');
const derived=java.compile(`class Child extends Parent {int value(){return n;}} class Parent {int n=5;} public class Main extends OpMode{Child child=new Child();int result;void loop(){result=child.value();}}`);
assert.equal(run(derived).scope.result,5,'parent may appear after subclass');
const explicitSuper=java.compile('class Child extends Parent {int extra=2; Child(int n){super(n);} int value(){return n+extra;}} class Parent {int n; Parent(int n){this.n=n;}} public class Main extends OpMode {Child child=new Child(5);int result;void loop(){result=child.value();}}');
assert.equal(run(explicitSuper).scope.result,7,'super runs before child field initialization');
const fieldExpressions=java.compile(`class Helper {
  String first="left"; String second="right"; String[] names; int count;
  void initialize(){names=new String[]{first,second};for(String name:names){count++;}}
}
public class Main extends OpMode {
  Helper helper=new Helper(); int result;
  void init(){helper.initialize();result=helper.count;}
  void loop(){}
}`);
assert.equal(run(fieldExpressions).scope.result,2,'array initializers and enhanced for expressions resolve helper-class fields');
assert.equal(compile([{name:'Main.java',source:'package robot; import Helper; public class Main extends OpMode {void loop(){}}'},{name:'Helper.java',source:'public class Helper {}'}]).ok,false,'unnamed-package classes cannot be imported');
const sameNames=[{name:'Main.java',source:'import a.Helper; public class Main extends OpMode{Helper h=new Helper(); int result;void loop(){result=h.value();}}'},
 {name:'a/Helper.java',source:'package a; public class Helper{int value(){return 1;}}'},
 {name:'b/Helper.java',source:'package b; public class Helper{int value(){return 2;}}'}];
assert.equal(run(compile(sameNames)).scope.result,1);
assert.equal(run(compile([{...sameNames[0],source:sameNames[0].source.replace('import a.Helper;','import b.Helper;')},...sameNames.slice(1)])).scope.result,2);
assert.equal(compile([{...sameNames[0],source:sameNames[0].source.replace('import a.Helper;','import a.*; import b.*;')},...sameNames.slice(1)]).ok,false,'ambiguous wildcard fails');
const entries=[{name:'One.java',source:'public class One extends OpMode {int result;void loop(){result=1;}}'},
 {name:'Two.java',source:'public class Two extends OpMode {int result;void loop(){result=2;}}'}];
assert.equal(run(compile(entries,{entry:'Two'})).scope.result,2,'the selected OpMode executes when a project contains several');
assert.equal(run(compile(entries,{entry:'One'})).scope.result,1);
assert.equal(compile(entries,{entry:'Missing'}).ok,false,'invalid entry cannot silently run a different OpMode');
assert.equal(run(compile([{name:'Main.java',source:'public class Main extends OpMode {static final int LIMIT=2;int result;void loop(){if(LIMIT<5){result=1;}}}'}])).scope.result,1,'capitalized constants in comparisons are not generic declarations');
assert.equal(compile([{name:'Main.java',source:'import java.util.ArrayList;public class Main extends OpMode {ArrayList<String> list;void loop(){}}'}]).ok,false,'unsupported generics produce a compile diagnostic');
const pedroGeneratedConstants = compile([{name:'Main.java',source:`import com.pedropathing.follower.Follower;
import org.firstinspires.ftc.teamcode.pedro.Constants;
import static com.pedropathing.api.Paths.line;
public class Main extends OpMode {void loop(){Follower follower=Constants.create(hardwareMap);}}`}]);
assert.equal(pedroGeneratedConstants.ok,true,'Pedro generated Constants is supplied by the simulator runtime');
const ivyLambda = java.compile('public class Main extends OpMode {void helper(){} void loop(){instant(() -> helper());}}');
assert.equal(ivyLambda.ok,true,'Ivy no-argument command lambdas transpile to JavaScript arrows');
const classLiteralFiles = [
  {name:'Main.java',source:'package robot; import robot.mechanisms.LinearSlide; public class Main extends OpMode { LinearSlide slide; void init(){slide=hardwareMap.get(LinearSlide.class,"slide");} void loop(){} }'},
  {name:'LinearSlide.java',source:'package robot.mechanisms; public class LinearSlide {}'},
];
const requestedTypes = [];
const classLiteralRuntime = java.createRuntime();
const classLiteralGet = classLiteralRuntime.hardwareMap.get.bind(classLiteralRuntime.hardwareMap);
classLiteralRuntime.hardwareMap.get = (type, name) => { requestedTypes.push(type); return classLiteralGet(type, name); };
const classLiteralProgram = java.compileProject(classLiteralFiles, classLiteralRuntime);
run(classLiteralProgram);
assert.deepEqual(requestedTypes, ['LinearSlide'], 'linked class literals keep their Java name in hardware diagnostics');
console.log('Java package linking and shared class runtime tests passed.');
