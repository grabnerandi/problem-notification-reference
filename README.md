# Dynatrace Problem Notification Reference Implementations
This repo provides reference implementations for custom Dynatrace Problem Notifications. While Dynatrace provides a set of out-of-the-box integrations with tools such as ServiceNow, xMatters, VictorOps, PagerDuty, Slack, HipChat, JIRA and others ... there is also an option to implement your own custom problem notification integration

This GitHub repo should be a good starting point in case you want to build your own custom problem notification integration.
The first sample we provide is written in Node.js and it implements several best practices
1. Validate Input Headers
2. Validate Input Values
3. Correctly Handle Test Notification Messages
4. Pull all Problem Details through Dynatrace REST API
5. Push a Comment back to Dynatrace

To run this sample and connect it with Dynatrace

**Pre-Requisits**
1. Sign-up for a [Dynatrace SaaS Free Trial](http://bit.ly/dtsaastrial)
2. You need to have node.js runtime and a tool such as [ngrok](https://ngrok.com/) to expose your local node.js app via a public IP. Alternatively you can obviously run the app on a public accessible web server
3. Clone or download this repository. Edit app.js and provide your Dynatrace Tenant URL as well as a Dynatrace API Token. This is required for the additonal pull and push data use cases!

**Lets GO:**
1. node app.js
2. ngrok http 80
3. In Dynatrace go to Settings -> Integration -> Problem Notification -> Set up notification -> Custom Integration
4. Configure the settings as shown in the following screenshot using your public IP address for the hosted service!

![](./images/customintegration.png)
