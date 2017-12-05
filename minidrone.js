'use strict'

var five = require("johnny-five");
var keypress = require('keypress');
var RollingSpider = require("rolling-spider");
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();

var ACTIVE = true;
var STEPS = 1;
var data = new RollingSpider({uuid:"e014c2d73d80"});

function cooldown() {
	ACTIVE = false;
	setTimeout(function (){
		ACTIVE = true;
	}, STEPS);
}

d.connect(function () {
	
	d.setup(function(){
		console.log('Configured for Rolling Spider! ', d.name);
		d.flatTrim();
		d.startPing();
		d.flatTrim();
		setTimeout(function(){
			console.log(d.name+ ' => SESSION START');
			ACTIVE = true;
		}, 1000);
	});
});

var board = new five.Board({
	port: "/dev/ttyMFD1"
});

var led1;
var led2;
var i;

//Sensor parameters
//For ARX model
const a1 = -0.981;
const a2 = 0.01653;
const b0 = 0.2833;
const b1 = -0.2706;
const thresholdR=0.033;
const thresholdL=0.039;
//For calculating ARX model
var yL=[0,0,0,0,0];
var ma_yL=[0,0,0];
var dyL=[0,0];
var uL=[0,0,0,0,0];
var ma_uL;
var yR=[0,0,0,0,0];
var ma_yR=[0,0,0];
var dyR=[0,0];
var uR=[0,0,0,0,0];
var ma_uR;

//CPT parameters
var cnt=0;
var dir=0;
var rfnc=0;
var state;
const STATE0=0;  //stay
const STATE1=1;  //surge
const STATE2=2;  //zigzag
const STATE3=3;  //zigzag
const STATE4=4;  //zigzag
const STATE5=5;  //loop

var stflag=0;

//timer
var start= new Date();
var end;
var executionTime;
const interval=33;


board.on("ready",function(){
	led1=new five.Led(7);
	led2=new five.Led(9);
	
	ledR=new five.Led(11); //Rightside Led in the light sensor	
	ledL=new five.Led(10); //Leftside Led in the light sensor
	
	this.repl.inject({
		led1: led1
	});
	this.repl.inject({
		led2: led2
	});
	
	//declare photo IC 
	var photoR = new five.Sensor({
		pin: "A2",
		freq: 10 //10ms sampling
	});
	var photoL = new five.Sensor({
		pin: "A1",
		freq: 10 //10 ms sampling
	});
	
	//for photo IC Rightside
	photoR.on('data', function(value){
		console.log(photoR);
		console.log(photoL);
	}
	
	//for photo IC leftside
	photoL.on('data', function(value){
		if (photoL < photoR){
			state = STATE0;
			d.XYZ({speed_X:0,speed_Y:0,speed_Z:0,speed_omega:-30});
			cooldown();
		}
		else if(photoL > photoR){
			state = STATE0;
			d.XYZ({speed_X:0,speed_Y:0,speed_Z:0,speed_omega:30});
			cooldown();
		}
	}
	
	
	//For gas sensor
	var sensor = new five.Sensor({
		pin: "A3",
		freq: 10 // this is for 10ms
	});
	
	sensor.on('data', function(value) {
		//update sensor value
		for(i=4; i>=0; i++){
			yL[i+1] = yL[i];
		}
		yL[0] = value*0.0049;
		
		//moving average filter
		for(i = 1; i >= 0; i--){
			ma_yL[i+1] = ma_yL[i];
		}
		ma_yL[0] = (yL[0]+yL[1]+yL[2]+yL[3]+yL[4])/5.0;
		
		 for(i = 1; i >= 0; i--){
			 dyL[i] = (ma_yL[i] - ma_yL[i+1])/(interval*0.001);
		}
		
		for(i = 4; i >= 0; i--){
			uL[i+1] = uL[i];
		}
		
		//model
		uL[0] = -a1 * uL[1] - a2 * uL[2] + b0 * dyL[0] + b1 * dyL[1];
		
		//moving average
		ma_uL = (uL[0]+uL[1]+uL[2]+uL[3]+uL[4])/5.0;
		
		if(ma_uR>thresholdR && ma_uR<0.2){
			dir=1;
			state = STATE1; //default state: stay
			cnt = 0;
		}
		
		
		//update behavior
		if(stflag==1){
			cnt=cnt+1;
			switch (state){
				case STATE0:
				break;
				
				case STATE1:
					if(cnt == 15){
					state = STATE2;
					cnt = 0;
				}
				break;
				
				case STATE2:
				if(cnt == 36){
					state = STATE3;
					if(dir==0) dir=1;
					else dir = 0;
					cnt = 0;
				}
				break;
				
				case STATE3:
				if(cnt == 57){
					state = STATE4;
					if(dir==0)dir = 1;
					else dir = 0;
					cnt = 0;					
				}
				break;
				
				case STATE4:
				if(cnt == 64){
					state = STATE5;
					if(dir == 0) dir=1;
					else dir=0;
					cnt =0;
				}
				break;
				
				case STATE5:
				if(cnt == 109){
					state=STATE2;
					if(dir ==0) dir =1;
					else dir = 0;
					cnt =0;
				}
				break;
			}
			
			switch (state){
				case STATE0:
				led1.off();
				led2.off();
				break;
				
				case STATE1:
				led1.on();
				led2.on();
				d.XYZ({speed_X:0,speed_Y:25,speed_Z:0,speed_omega:0});
				cooldown();
				break;
				
				case STATE2:
				case STATE3:
				case STATE4:
				case STATE5:
				if(dir == 0){
					led1.on();
					led2.off();
					
					//turn left
					d.XYZ({speed_X:0,speed_Y:0,speed_Z:0,speed_omega:30});
					cooldown();
				}
				else if(dir == 1){
					led1.off();
					led2.on();
					
					//turn right
					d.XYZ({speed_X:0,speed_Y:0,speed_Z:0,speed_omega:-30});
					cooldown();
				}
				break;
			}
		}
		else {
			state = STATE0;
		}
		
		end = new Date();
		executionTime = end.getTime() - start.getTime();
		while (executionTime < interval){
			end = new Date();
			executionTime = end.getTime() - start.getTime();
		}
		start = new Date();
		
		console.log(executionTime + ',',ma_uL);
	});
});

// listen for the "keypress" event

process.stdin.on('keypress', function (ch, key) {
	if (ACTIVE && key) {
		var param = {tilt:0, forward:0, turn:0, up:0};

		if (key.name === 'l') {
			console.log('land');
			d.land();
      led1.off();
			led2.off();
      stflag=0;
		} else if (key.name === 't') {
			console.log('takeoff');
			d.takeOff();
		} else if (key.name === 'h') {
			console.log('hover');
			d.hover();
		} else if (key.name === 'x') {
			console.log('disconnect');
			d.disconnect();
			process.stdin.pause();
			process.exit();
		}

		if (key.name === 'up') {
			d.forward({ steps: STEPS });
			cooldown();
		} else if (key.name === 'down') {
			d.backward({ steps: STEPS });
			cooldown();
		} else if (key.name === 'right') {
			d.tiltRight({ steps: STEPS });
			cooldown();
		} else if (key.name === 'left') {
			d.tiltLeft({ steps: STEPS });
			cooldown();
		} else if (key.name === 'u') {
			d.up({ steps: STEPS });
			cooldown();
		} else if (key.name === 'd') {
			d.down({ steps: STEPS });
			cooldown();
		}

		if (key.name === 'm') {
			param.turn = 90;
			d.drive(param, STEPS);
			cooldown();
		}
		if (key.name === 'h') {
			param.turn = -90;
			d.drive(param, STEPS);
			cooldown();
		}
		if (key.name === 'f') {
			d.frontFlip();
			cooldown();
		}
		if (key.name === 'b') {
			d.backFlip();
			cooldown();
		}
		if (key.name === 'g') {
			stflag=1;
		}
    if (key.name === 's') {
			state=STATE1;
      cnt = 0;
		}

	}
});
