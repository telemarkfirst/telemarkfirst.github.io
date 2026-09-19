const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const java=require('../static/simulator/telemark-java.js');
const ctx={TelemarkJava:java};ctx.window=ctx;
vm.runInNewContext(fs.readFileSync('static/simulator/telemark-project-checks.js','utf8'),ctx);
const fixtures={
 '8.1':{
 fields:'DcMotor roller;',init:'roller=hw.get(DcMotor.class,"intake");',
 loop:'roller.setPower(pad.right_trigger>0.5?1:0);tel.addData("Power",roller.getPower());',
 bad:['pad.right_trigger>0.5?1:0','0'],
 },
 '8.2':{
 fields:'DcMotor a;DcMotor b;DcMotor c;DcMotor d;',
 init:'a=hw.get(DcMotor.class,"left_front");b=hw.get(DcMotor.class,"right_front");c=hw.get(DcMotor.class,"left_back");d=hw.get(DcMotor.class,"right_back");a.setDirection(DcMotor.Direction.REVERSE);c.setDirection(DcMotor.Direction.REVERSE);',
 loop:'double y=-pad.left_stick_y;double x=pad.left_stick_x;double r=pad.right_stick_x;a.setPower(y+x+r);b.setPower(y-x-r);c.setPower(y-x+r);d.setPower(y+x-r);',
 bad:['a.setPower(y+x+r)','a.setPower(y-x+r)'],
 },
 '8.3':{
 fields:'DcMotor m;',init:'m=hw.get(DcMotor.class,"lift");',
 loop:'if(pad.y){m.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);}if(pad.x){m.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.FLOAT);}tel.addData("Mode",m.getZeroPowerBehavior());',
 bad:['if(pad.x)','if(false)'],
 },
 '8.4':{
 fields:'DcMotor left;DcMotor right;',
 init:'left=hw.get(DcMotor.class,"motor1");right=hw.get(DcMotor.class,"motor2");left.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);right.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);',
 loop:'left.setPower(pad.b?0:-pad.left_stick_y);right.setPower(pad.b?0:-pad.right_stick_y);tel.addData("Status",pad.b?"EMERGENCY STOP":"Driving");',
 bad:['pad.b?0:-pad.left_stick_y','-pad.left_stick_y'],
 },
 '8.5':{
 fields:'DcMotor m;DigitalChannel top;DigitalChannel bottom;',
 init:'m=hw.get(DcMotor.class,"slide");top=hw.get(DigitalChannel.class,"limit_upper");bottom=hw.get(DigitalChannel.class,"limit_lower");top.setMode(DigitalChannel.Mode.INPUT);bottom.setMode(DigitalChannel.Mode.INPUT);m.setDirection(DcMotor.Direction.REVERSE);m.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);',
 loop:'double p=-pad.left_stick_y;if((p>0&&!top.getState())||(p<0&&!bottom.getState())){p=0;}m.setPower(p);tel.addData("Upper Limit",!top.getState());tel.addData("Lower Limit",!bottom.getState());tel.addData("Power",p);',
 bad:['p>0&&!top.getState()','false'],
 },
 '9.1':{
 fields:'Servo s;',init:'s=hw.get(Servo.class,"gate");',
 loop:'if(pad.y){s.setPosition(0.75);}else if(pad.a){s.setPosition(0);}tel.addData("Gate",s.getPosition());',
 bad:['s.setPosition(0.75)','s.setPosition(0.25)'],
 },
};
for(const [unit,f] of Object.entries(fixtures)) {
 const files=[{name:'Main.java',source:'import robot.Mechanism;public class Main extends OpMode {Mechanism h=new Mechanism();public void init(){h.init(hardwareMap);}public void loop(){h.tick(gamepad1,telemetry);}}'},
 {name:'Mechanism.java',source:`package robot;import com.qualcomm.robotcore.hardware.Gamepad;import org.firstinspires.ftc.robotcore.external.Telemetry;public class Mechanism {${f.fields}public void init(HardwareMap hw){${f.init}}public void tick(Gamepad pad,Telemetry tel){${f.loop}tel.update();}}`}];
 const check=files=>ctx.TelemarkProjectChecks.evaluate(unit,java.serializeProject(files));
 const good=check(files);assert.ok(good.requirements.every(Boolean),unit+': '+JSON.stringify(good));
 const bad=check([files[0],{...files[1],source:files[1].source.replace(...f.bad)}]);
 assert.ok(!bad.requirements.every(Boolean),unit+': broken behavior must fail');
 assert.ok(!check([{...files[0],source:files[0].source.replace('import robot.Mechanism;','')},files[1]]).requirements.some(Boolean),unit+': missing import fails all checks');
 assert.ok(!check(files.map(f=>({...f,source:'/*'+f.source+'*/'}))).requirements.some(Boolean),unit+': comments cannot pass');
}
console.log('Imported mechanism behavioral checks passed for Units 8.1–8.5 and 9.1.');
