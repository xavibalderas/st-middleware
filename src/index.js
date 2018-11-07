var express = require('express');
var app = express();
var server = require('http').createServer(app, {'pingTimeout': 7000, 'pingInterval': 3000});
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var NodeCache = require("node-cache");
var detectionCache = new NodeCache({checkperiod: 3});
var detectionCounter = 0;
var socket;
var nodemailer = require('nodemailer');

var materialsHandler = require ('./materialsDownload.js');
import pdfGen from './pdfGen.js';

var validator = require("email-validator");




const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 465,
		secure: false,
    auth: {
        user: 'q3weizbhqqn2hxrq@ethereal.email',
        pass: 'J8q6vJBUw3bWTnS95r'
    }
});



// Object timer, with start, stop and reset methods.
function Timer(funct, time) {
	var timerObj = setInterval(funct, time);

	this.stop = function() {
		if(timerObj) {
			clearInterval(timerObj);
			timerObj = null;
		}
		return this;
	}

	this.start = function() {
		if(!timerObj) {
			this.stop();
			timerObj = setInterval(funct, time);
		}
		return this;
	}

	this.reset = function(newTime) {
		time = newTime;
		return this.stop().start();
	}
}

// Timer that sends special tag when no detections are received in a threshold time.
var no_detectionTimer = new Timer(function() {
	console.log("No tags detected, sending default");
	if (socket !== undefined ){
		socket.emit('tag', [])
	}
}, 2000000);



app.use(bodyParser.json());


app.post('/mail', function (req, res, next){
	console.log(">>Prepared to send an email " + String(Date.now()));
	console.log(req.body);
	const mail= req.body.mail;
	const validMail = validator.validate(mail);

	if (validMail== false){
		res.send("Email address not valid.");
		return
	}
	 	
	const materials = req.body.materials;
	let _text = '';
	for (var i = 0; i < materials.length; i++) {
      	_text += 'Material: ' + materials[i].name + ' ';

  }
	pdfGen.generateDoc(materials);
	var mailOptions = {
  	from: 'xavibalderas@gmail.com',
  	to: 'franciscojavier.balderas@ikea.com',
  	subject: 'Testing if the mail function works!',
  	text: _text
	};

	transporter.sendMail(mailOptions, function(error, info){
  	if (error) {
    	console.log(error);
  	} else {
    	console.log('Email sent: ' + info.response);
  	}
	});
	res.send("Email sended");

})

// ON DETECTION
app.post('/', function(req, res, next) {
	//
	no_detectionTimer.reset(50000);
	console.log(">>RECEIVING DETECTION " + String(Date.now()));
	res.send('Received');

	if (socket !== undefined ){

		console.log(req.body);
		// let's search the tag in the cache
		var target = req.body.reads[0].TAG;
		detectionCache.get(target, function(err, value) {
			if (!err){
				// not found or expired
				if (value == undefined) {
						// let's add it
						var success = detectionCache.set(target, target, 5);
						if (success) {
							console.log("//CACHE-INFO: added tag: " + target);
						} else {
							console.log("//CACHE-ERROR: can't add tag");
						}
				} else {
					// it exists, so we're going to renew the TTL
					detectionCache.ttl( target, 5, function(err, changed){
						if (!err){
							if (!changed){
								console.log("//CACHE-ERROR: can't renew TTL");
							} else {
								console.log("//CACHE-INFO: renewed tag ");
							}
						}
					});
				}
			}
		});

		// Send all the cache keys to Client
		var keylist = detectionCache.keys();
		socket.emit('tag', keylist);
		console.log(">>SENDING:");
		console.log(keylist);
		console.log('\n');
		}
	});

console.log('Working');

// ON CONNECTION
io.on('connection', function(client) {
	socket = client;
	console.log('*** Client connected: ' + client.id + ' -- Client address: ' + client.handshake.address );
	no_detectionTimer.start();
	client.on('join', function(data){
		console.log(data);
		client.emit('messages', 'Hello world');
	});
  client.on('disconnect', function() {
    console.log('*** Client disconnected: ' + client.id + ' -- Client address: ' + client.handshake.address );
   });
	 client.on('pong', function(data){
			 console.log("Pong received from client");
	 });
});

function sendHeartbeat(){
    setTimeout(sendHeartbeat, 8000);
    io.sockets.emit('ping', { beat : 1 });
		console.log("PING");
}


setTimeout(sendHeartbeat, 8000);

server.listen(4200);

//pdfGen.generateDoc();

//materialsHandler.downloadMaterials();
