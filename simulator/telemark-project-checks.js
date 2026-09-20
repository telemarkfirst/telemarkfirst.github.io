/* Isolated behavioral checks: run the complete project, without changing the scene. */
(function(root) {
  'use strict';
  const ids = {
    '8.1':['req1','req2','req3','req4'],
    '8.2':['req-lf-map','req-rf-map','req-lb-map','req-rb-map','req-lf-rev','req-lb-rev','req-math'],
    '8.3':['req-map','req-brake','req-float','req-telemetry'],
    '8.4':['req-map1','req-map2','req-brake','req-estop','req-telemetry'],
    '8.5':['req-lift','req-limit','req-negate','req-block','req-up','req-telemetry'],
    '9.1':['map','open','close','telemetry'],
  };
  function evaluate(unit, source) {
    const failed = {requirements:ids[unit].map(()=>false), diagnostics:[]};
    try {
      let pressed = new Set(), rows = [];
      const runtime=root.TelemarkJava.createRuntime({getDigitalState:d=>!pressed.has(d.name),onTelemetryUpdate:data=>{rows.push(...data);}});
      const program=root.TelemarkJava.compile(source,runtime);
      if(!program.ok) return {...failed,diagnostics:program.diagnostics};
      if(program.kind!=='iterative'||!program.methods.init||!program.methods.loop) return failed;
      program.methods.init();
      const mapped = new Map([...runtime.devices].map(([key,d])=>[key,{...d._state}]));
      program.methods.start?.();
      const get=(type,...names)=>names.map(n=>runtime.devices.get(type+':'+n)).find(Boolean);
      const init=(type,...names)=>names.map(n=>mapped.get(type+':'+n)).find(Boolean);
      const close=(a,b)=>typeof a==='number' && Math.abs(a-b)<0.00001;
      const tick=(pad={},sensors=[])=>{
        Object.keys(runtime.gamepad1).forEach(k=>{runtime.gamepad1[k]=typeof runtime.gamepad1[k]==='boolean'?false:0;});
        Object.assign(runtime.gamepad1,pad);pressed=new Set(sensors);rows=[];runtime.clearTelemetry();
        program.methods.loop();
        // Iterative FTC telemetry is sent at the end of each loop as well.
        runtime.updateTelemetry();
      };
      let requirements;
      if(unit==='8.1') {
        const mappedIntake=!!init('DcMotor','intake');
        tick({right_trigger:0.8}); const on=close(get('DcMotor','intake')?.getPower(),1), telemOn=rows.length>0;
        tick({right_trigger:0.2}); const off=close(get('DcMotor','intake')?.getPower(),0);
        tick({right_trigger:0.9}); const again=close(get('DcMotor','intake')?.getPower(),1);
        tick(); requirements=[mappedIntake,on&&again,off&&close(get('DcMotor','intake')?.getPower(),0),telemOn&&rows.length>0];
      } else if(unit==='8.2') {
        const names=[['left_front','leftFront'],['right_front','rightFront'],['left_back','leftBack'],['right_back','rightBack']];
        requirements=names.map(n=>!!init('DcMotor',...n));
        requirements.push(init('DcMotor',...names[0])?.direction==='REVERSE',init('DcMotor',...names[2])?.direction==='REVERSE');
        let correct=true;
        for(const [drive,strafe,rotate] of [[0.4,0,0],[0,0.3,0],[0,0,0.2],[0.2,-0.1,0.3],[0,0,0]]) {
          tick({left_stick_y:-drive,left_stick_x:strafe,right_stick_x:rotate});
          const expected=[drive+strafe+rotate,drive-strafe-rotate,drive-strafe+rotate,drive+strafe-rotate];
          correct=correct&&names.every((n,i)=>close(get('DcMotor',...n)?.getPower(),expected[i]));
        }
        requirements.push(correct);
      } else if(unit==='8.3') {
        const mappedLift=!!init('DcMotor','lift');
        tick({y:true}); const brake=get('DcMotor','lift')?._state.zeroPowerBehavior==='BRAKE';
        const brakeTelemetry=rows.some(r=>/mode/i.test(r.key)&&/BRAKE/i.test(String(r.value)));
        tick({x:true}); const floating=get('DcMotor','lift')?._state.zeroPowerBehavior==='FLOAT';
        requirements=[mappedLift,brake,floating,brakeTelemetry&&rows.some(r=>/mode/i.test(r.key)&&/FLOAT/i.test(String(r.value)))];
      } else if(unit==='8.4') {
        const motors=['motor1','motor2'];
        requirements=motors.map(n=>!!init('DcMotor',n));
        requirements.push(motors.every(n=>init('DcMotor',n)?.zeroPowerBehavior==='BRAKE'));
        tick({left_stick_y:-0.6,right_stick_y:0.4});
        const moves=motors.every(n=>Math.abs(get('DcMotor',n)?.getPower())>0.1);
        tick({left_stick_y:-0.6,right_stick_y:0.4,b:true});
        requirements.push(moves&&motors.every(n=>close(get('DcMotor',n)?.getPower(),0)));
        requirements.push(rows.some(r=>/emergency stop/i.test(r.key+' '+r.value)));
      } else if(unit==='8.5') {
        const motor=()=>get('DcMotor','slide');
        const sensors=['limit_upper','limit_lower'];
        const mappedSensors=sensors.every(n=>init('DigitalChannel',n)?.mode==='INPUT');
        tick({left_stick_y:-0.6}); const up=close(motor()?.getPower(),0.6);
        const telemetry=rows.some(r=>/Upper Limit/i.test(r.key))&&rows.some(r=>/Lower Limit/i.test(r.key))&&rows.some(r=>/Power/i.test(r.key));
        tick({left_stick_y:0.4}); const down=close(motor()?.getPower(),-0.4);
        tick({left_stick_y:-0.6},['limit_upper']); const upper=close(motor()?.getPower(),0);
        tick({left_stick_y:0.4},['limit_upper']); const retreatDown=close(motor()?.getPower(),-0.4);
        tick({left_stick_y:0.4},['limit_lower']); const lower=close(motor()?.getPower(),0);
        tick({left_stick_y:-0.6},['limit_lower']); const retreatUp=close(motor()?.getPower(),0.6);
        tick(); const idle=close(motor()?.getPower(),0);
        requirements=[!!init('DcMotor','slide'),mappedSensors,
          up&&down&&init('DcMotor','slide')?.direction==='REVERSE'&&init('DcMotor','slide')?.zeroPowerBehavior==='BRAKE',
          upper&&retreatDown,lower&&retreatUp&&idle,telemetry];
      } else if(unit==='9.1') {
        const mappedGate=!!init('Servo','gate');
        tick({y:true}); const open=close(get('Servo','gate')?.getPosition(),0.75),openRows=JSON.stringify(rows);
        tick({a:true}); const shut=close(get('Servo','gate')?.getPosition(),0);
        requirements=[mappedGate,open,shut,rows.length>0&&openRows!=='[]'&&openRows!==JSON.stringify(rows)];
      }
      return {requirements:requirements.map(Boolean),diagnostics:[]};
    } catch(error) { return {...failed,diagnostics:[{message:error.message}]}; }
  }
  function render(unit,editor) {
    const result=evaluate(unit,editor.__telemarkProject?editor.__telemarkProject.source():editor.value);
    ids[unit].forEach((id,i)=>{const check=root.document.getElementById(id)?.querySelector('.check');if(check)check.className='check '+(result.requirements[i]?'pass':'fail');});
    root.document.getElementById('success-banner')?.classList.toggle('visible',result.requirements.every(Boolean));
    const hints=root.document.getElementById('hint-container');
    if(hints) {hints.textContent='';if(result.diagnostics.length){const hint=root.document.createElement('div');hint.className='hint error';hint.textContent=(result.diagnostics[0].file?result.diagnostics[0].file+': ':'')+result.diagnostics[0].message;hints.appendChild(hint);}}
    return result;
  }
  root.TelemarkProjectChecks={evaluate,render};
})(typeof window==='object'?window:globalThis);
