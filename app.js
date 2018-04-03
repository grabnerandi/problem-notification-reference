var port = process.env.PORT || 80,
    http = require('http'),
    fs = require('fs'),
	os = require('os'),
	url = require('url'),
	https = require('https');

// ======================================================================
// Here are some global config entries that change the behavior of the app
// ======================================================================
// var DT_API_URL = "https://YOURTENTANT.live.dynatrace.com";
var DT_API_URL = "https://hci34192.live.dynatrace.com"
// var DT_API_TOKEN = "YOURTOKEN!";
var DT_API_TOKEN = "STervj4xTNynLdbVaZLq9";
var requiredFields = ["PID","ImpactedEntities"];
var requiredHeaders = ["x-source"];

// ======================================================================
// This is for logging
// ======================================================================
var logstream = fs.createWriteStream('./serviceoutput.log');
var SEVERITY_DEBUG = "Debug";
var SEVERITY_INFO = "Info";
var SEVERITY_WARNING = "Warning";
var SEVERITY_ERROR = "Error";

var log = function(severity, entry) {
	// console.log(entry);
	if (severity === SEVERITY_DEBUG) {
		// dont log debug
	} else {
		var logEntry = new Date().toISOString() + ' - ' + severity + " - " + entry + '\n';
		// fs.appendFileSync('./serviceoutput.log', new Date().toISOString() + ' - ' + severity + " - " + entry + '\n');
		logstream.write(logEntry);
	}
};

// ======================================================================
// Our little helper functions
// ======================================================================
var dtApiPost = function(dtUrl, dtToken, body, callback) {
    console.log("dtApiPost: " + dtUrl);
    
    var fullUrl = url.parse(dtUrl);
    var bodyString = body == null ? "" : JSON.stringify(body);
    
    // An object of options to indicate where to post to
    var post_options = {
      host: fullUrl.host,
      path: fullUrl.path,
      method: body == null ? 'GET' : 'POST',
      headers: {
          'Authorization': 'Api-Token ' + dtToken,
          'Content-Length': Buffer.byteLength(bodyString),
          'Content-Type' : 'application/json'
      }
    };

    // Set up the request
    var post_req = https.request(post_options, function(res) {
        var responseBody = "";
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            responseBody += chunk;
        });
        res.on('end', function() {
            callback(res.statusCode, responseBody);
        });
    });

    // post the data
    if(body != null) post_req.write(bodyString);
    post_req.end();
}

var writeResponse = function(res, response) {
	res.writeHead(response.statusCode, response.StatusCodeText, response.headers);
	res.write(response.body);
	res.end();
	log(SEVERITY_INFO, response.statusCode + " - " + response.statusCodeText + ": " + response.body);
}

var exptectedHeaders = function(req, response) {
	var allHeadersExists = true;
	for(var requiredHeaderIx in requiredHeaders) {
		if(!req.headers[requiredHeaders[requiredHeaderIx]] || (req.headers[requiredHeaders[requiredHeaderIx]] == null)) {
			allHeadersExists = false;
			response.statusCode = 400;
			response.statusCodeText = "ERROR";
			response.body = "Expected Header '" + requiredHeaders[requiredHeaderIx] + "' not passed: " + JSON.stringify(req.headers);	
			break;
		}
	}
	return allHeadersExists;
}

var parsePostBody = function(body, response) {
	try {
		var problemObject = JSON.parse(body);
		return problemObject;
	} catch(error) {
		response.statusCode = 400;
		response.body = "Expected valid JSON: " + error;
		return null;
	}
}

var expectedFields = function(problemObject, response) {
	if(!problemObject) return false;

	var allFieldsExists = true;
	for (var requiredFieldIx in requiredFields) {
		if(!problemObject[requiredFields[requiredFieldIx]] || (problemObject[requiredFields[requiredFieldIx]] == null)) {
			allFieldsExists = false;
			response.body = "Expected field '" + requiredFields[requiredFieldIx] + "' missing!";
			break;
		}
	}

	return allFieldsExists;
}

var isTestNotification = function(problemObject) {
	if(problemObject["ProblemID"] == "TESTID") return true;
	if(JSON.stringify(problemObject).includes("XXXXXXXXXXXXX")) return true;
	return false;
}

function getFullProblemDetails(pid) {
	var dtUrl = DT_API_URL + "/api/v1/problem/details/" + pid;
	dtApiPost(dtUrl, DT_API_TOKEN, null, function(statusCode, responseBody) {
		log("Retrieving full problem details: " + responseBody);
	});	
}

var pushProblemComment = function(pid, comment, user, context) {
	var dtUrl = DT_API_URL + "/api/v1/problem/details/" + pid + "/comments";
	var commentObject = {
		comment : comment,
		user : user,
		context : context
	}
	dtApiPost(dtUrl, DT_API_TOKEN, commentObject, function(statusCode, responseBody) {
		log("Pushing Comment Resulted in " + statusCode);
	});
}

// ======================================================================
// This is our main HttpServer Handler that expects a Dynatrace Problem Notification HTTP POST Request
// ======================================================================
var server = http.createServer(function (req, res) {
	// Default Response!
	var response = {
		statusCode: 400,
		statusCodeText: "ERROR", 
        headers : { "content-type" : "text/plain" },
        body: "Something didnt go as expected"
    };

	// Handling HTTP POSTs
    if (req.method === 'POST') {
		// read HTTP POST data until we reach the end!
        var body = '';
        req.on('data', function(chunk) {  body += chunk; });
        req.on('end', function() {
			log(SEVERITY_INFO, 'On URI ' + req.url + ' we received body: ' + body);

			if (req.url === '/dthandler') {
				// #1: Check if we expect certain HTTP Headers
				if(!exptectedHeaders(req, response)) {
					writeResponse(res, response);
					return;
				}

				// #2: Check whether the posted data is a valid JSON
				var problemObject = parsePostBody(body, response);
				if(problemObject == null) {
					writeResponse(res, response);
					return;
				}

				// #3: Check whether the posted JSON has the required fields
				if(!expectedFields(problemObject, response)) {
					writeResponse(res, response);
					return;
				}

				// #4: Check whether this is a Test Notification
				if(isTestNotification(problemObject)) {
					response.statusCode = 200;
					response.statusCodeText = "OK";
					response.body = "Test Notification Successfully processed!!";
					writeResponse(res, response);
					return;
				}

				// #5: Lets get all the problem Details by calling the Problem REST API
				getFullProblemDetails(problemObject["PID"]);

				// #6: Lets post a comment back to this problem to indicate we handled it
				pushProblemComment(problemObject["PID"], "We received the problem status update. Current Status: " + problemObject["State"], "myuser", "SampleNotificationHandler");

				response.statusCode = 200;
				response.statusCodeText = "OK";
				response.body = "Seems that everything went fine!";

				writeResponse(res, response);
				return;
            } else  {
				response.statusCode = 400;
				response.statusCodeText = "ERROR";
				response.body = "Not supported endpoint: " + req.url + ". Try /dthandler";
				log(SEVERITY_ERROR, response.body);
				writeResponse(res, response);
				return;
            }
        });
    } else 	{
		// for anything else just write our current status
		response.statusCode = 200;
		response.statusCodeText = "OK";
		response.body = "Thanks for calling our Dynatrace Problem Notification Handler";
		writeResponse(res, response);
		return;
	}	
});

// Listen on port 80, IP defaults to 127.0.0.1
server.listen(port);

// Put a friendly message on the terminal
console.log('Server running at http://127.0.0.1:' + port + '/');
log(SEVERITY_INFO, "Service is up and running - feed me with data!");