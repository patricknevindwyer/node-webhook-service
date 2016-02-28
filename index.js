"use strict";

var request = require("request");

module.exports = {
    
    Service: class Service {
        
        constructor(remoteWebhook) {
            this.webhookRemoteURI = remoteWebhook;
            this.resolveInterval = 1000;
            this.resolveQueue = [];
            this.resolvedData = {};
            
            this.resolveFunc = function (item, next) {next();};
        }
        
        useRouter(router) {

            var t = this;

            /*
                Expecting a JSON body of the form:
                    {
                        "uuid": <uuid>,
                        "uri": <full uri>
                    }
                    
                    or
                    
                    {
                        "uuid": <uuid>,
                        "ip": <ip address>
                    }
                    
                The route that is called via Webhook will change based on the incoming 
                resolve features.
            */
            
            router.post("/resolve", function (req, res, next) {
    
                t.resolveQueue.push(req.body);
                res.json({error: false, msg: "ok"});
    
            });

            router.get(/^\/resolved\/([a-zA-Z0-9\-]+)\/?$/, function (req, res, next) {
                var resolveUuid = req.params[0];
                console.log("Results being retrieved for [%s]", resolveUuid);
                if (t.resolvedData[resolveUuid] !== undefined) {
                    res.json({error: false, result: t.resolvedData[resolveUuid]});
                }
                else {
                    console.log("Invalid UUID specified");
                    res.json({error: true, msg: "No such resolved UUID"});
                }
            });
            
            router.delete(/^\/resolved\/([a-zA-Z0-9\-]+)\/?$/, function (req, res, next) {
                var resolveUuid = req.params[0];
                console.log("Deleting results for [%s]", resolveUuid);
                delete t.resolvedData[resolveUuid];
                res.json({error: false, msg: "ok"});
            });    
        }
        
        saveResolved(uuid, obj) {
            this.resolvedData[uuid] = obj;    
        }
        
        start() {
            this.checkResolveQueue();
        }
        
        callResolver(resolver) {
            this.resolveFunc = resolver;
        }
        
        tickleWebhook(path, next) {
            request(this.webhookRemoteURI + path + "/ready", function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    next();
                }
                else {
                    console.log("Error calling remote webook at [%s]\n\tcode: %d\n\terror: %s", this.webhookRemoteURI + path, response.statusCode, error);
                    next();
                }
            });   
        }
        
        /*
            Generic queue check and drain that kicks off at most
            every RESOLVE_INTERVAL milliseconds. 
        */
        checkResolveQueue() {
    
            if (this.resolveQueue.length > 0) {
                var resolveItem = this.resolveQueue.shift();
                var t = this;
                this.resolveFunc(resolveItem, 
                    function () {
                        setTimeout(t.checkResolveQueue.bind(t), t.resolveInterval);
                    }
                );
            }
            else {
                setTimeout(this.checkResolveQueue.bind(this), this.resolveInterval);
            }
        }

        
    }
}