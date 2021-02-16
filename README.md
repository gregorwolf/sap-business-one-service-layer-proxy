# SAP Business One Service Layer Reverse Proxy

This reverse proxy can be installed in front of the SAP Business One Service Layer to improve it's performance for multiple requests. Unfortunately the initial request to the Service Layer is very slow using basic authentication. The next requests are faster when you use the session cookie. But for requests coming from the SAP Cloud Applicaiton Programming Model the cookies are not handled. This proxy adds the functionality to cache the cookies. As the cookies are only valid for 30 minutes also a this timeout must be checked.

## Basic procedure

- Check that the request contains an authorization header
- Check if session for authorization header exists, if not create session with current timestamp
- if session exists check if the timeout was reached and delete the cookie
- if there is a cookie in the session forward it in the request
- when the response contains a cookie, store it in the session

## Configuration

The configuration is done via the following environment variables:

- TARGET_URL defines the URL of the Service Layer
- PORT defines the port the proxy is listening to
- TIMEOUT defines the session timeout in seconds
- START_TESTSERVER defines if the testserver should be started
- LOG_LEVEL is set to info by default. With debug you get a deeper insight
- LOG_AS_TEXT pretty print the log output

To setup the environment variables quickly the dotenv module is included in the project. So you can create a *.env* file in the root folder of this project and add the following content:

```
TARGET_URL=http://127.0.0.1:4004
PORT=5050
TIMEOUT=1500
START_TESTSERVER=true
LOG_LEVEL=debug
LOG_AS_TEXT=true
```

## Execution

To run the project on your local computer you have to install the required dependencies with

`npm i`

Then you can start it with:

`npm start`
