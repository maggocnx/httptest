var express = require("express");
var app = express();
var server = require('http').Server(app);
var Path = require("path");
var port = 3000;
var moment = require('moment');
var fs = require('fs');
var _ = require("underscore");
var bodyParser = require('body-parser')
var randomstring = require("randomstring");

var config = require("./config.json");
var clients = {};
var orders = {};
var queue = {};

app.use(bodyParser.json())
app.use("/", express.static(Path.join(__dirname, '/')));

app.param('devId', function(req, res, next, devId) {
	console.log(devId + " connected");
	next();
});

app.get("/com/:devId/:testDelay?/:type?", function(req,res){

	var type = (req.params.type) ? req.params.type : 1; 
	var devId = req.params.devId;
	var testDelay = req.params.testDelay;

	console.log(req.params)

	if(testDelay){
		createOrder(type,null,function(order){
			if(order){
				setTimeout(function(){
					res.send(order);
					delete clients[devId];
				}, testDelay);
			}
			else{
				res.sendStatus(500);
			}
		});
	}
	else{
		if(queue[devId]){
			res.send(queue[devId]);
			delete queue[devId];
		}
		else{
			clients[devId] = { res : res}; 
		}
	}
});

app.get("/ping", function(req,res){
	// console.log("Health check");
	res.sendStatus(200);
});

app.post("/com/:devId", function(req,res){
	var response = getResponse(req.body);

	if(!response) return res.sendStatus(500);

	if(!response.err){
		res.send(200, response);
	}
	else{
		res.send(500, response);
	}
});

app.get("/order/:recipientId/:type?/:orderId?", function(req,res){
	var type = (req.params.type) ? req.params.type : 1; 
	var devId = req.params.recipientId;
	var device = clients[devId];

	createOrder(type,null,function(order){
		if(order){

			if(device){
				device.res.send(order);
				delete clients[	devId];
				res.send({msg : "order send"})
			}else{
				queue[devId] = order;
				res.send({msg : "order queued"})
			}
		}
		else{
			res.sendStatus(500);
		}
	})
});


createOrder = function(type,orderId,callback){

	fs.readFile('./testorder'+ type + '.json', function(err, data){
		if(!err){

			orderId = randomstring.generate(4) + '-' +  randomstring.generate(4);
			var order = JSON.parse(data.toString());

			order.id = orderId;
			order.ot = moment().format("MM/DD HH:mm");
			order.type = 'order';
			orders[order.id] = order;
			var response = {req : order};
			
			return callback(response);
		}
		else{
			return callback(null);
		}
	});

}

app.get("/info/:recipientId/", function(req,res){
	var devId = req.params.recipientId;

	fs.readFile('./testorder4.json', function(err, data){
		var info = JSON.parse(data.toString());

		if(clients[devId]){
			clients[devId].res.send({info : JSON.parse(data)});
			delete clients[devId];
		}

		res.sendStatus(200);
	});

});

app.post("/send/:recipientId", function(req,res){
	var devId = req.params.recipientId;

		console.log(req.body)

	console.log(devId + "XXXXXXXX")
	if(clients[devId]){
		clients[devId].res.send(req.body);
		delete clients[devId];
	}
	res.sendStatus(200);
});

function getResponse(data){
	var command = _.keys(data)[0];
	var message = data[command];
	var response = null;
	
	console.log(data)
	
	switch(command){
		case "reg" :
			response =  {
				reg : {
					ts : moment.utc().add(120,'m').unix(),
					il : config.welcomeMessage,
					lg : config.language,
					cu : config.currency, 
					pt : config.pingTime
				}
			};
		break;


		case "png" : 
			if(config.logLevel > 1){
				response = { last_ping: new Date()}
			}
		break;

		case "ack" :
			response = {ack : message};
		break;	

		case "con" : 
			orderId = message.id;
			order = orders[orderId];
			if(!order){
				return {err : "order not found"};
			}

			if(order.type == 'reservation'){

				response = {ord:
					{
						id:orderId,
						bt: order.bt
					}
				}
			}
			else if(order.type == 'order'){
				if(message.dt > 1000 || !message.dt){
					message.dt = 60;
				}
				time = moment().add(message.dt,'m').format("HH:mm");
				response = {
					ord : {
						id : orderId,
						bt : time,
						pm : "bar",
					 	n1 : config.n1,
					 	n2 : config.n2,
					 	pm : config.pm,
					 	tt : order.tt,
					 	lt : config.lt
					}
				};
			}
		break;
	}

	return response;
}

server.listen(port , function(){
	console.log("Webserver listening on port " + port);
});
