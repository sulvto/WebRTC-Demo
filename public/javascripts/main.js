/**
 * Created by sulvto on 16-1-30.
 */
window.moz = !!navigator.mozGetUserMedia;

var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection ||
        window.webkitRTCPeerConnection || window.msRTCPeerConnection,

    SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription ||
        window.webkitRTCSessionDescription || window.msRTCSessionDescription,

    IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;

var RTCDataChannels = [];
var peer = [];
var signalingChannel = io();
var id = null;

signalingChannel.emit('id', peer.length);


signalingChannel.on("id", function (msg) {
    console.log(msg);
    id = msg;
    signalingChannel.emit('pcid', id);
});

signalingChannel.on("pcid", function (pcid) {
    console.log(pcid);
    start(pcid, 0, null);
});
signalingChannel.on("onicecandidate", function (message) {
    console.log(message);
    if (peer.length > 0) {
        //peer[pcid]
        peer[0].addIceCandidate(new IceCandidate({
            sdpMLineIndex: message.sdpMLineIndex,
            candidate: message.candidate
        }));
    }
});
signalingChannel.on("createOffer", function (message) {
    console.log(message);
    var sdp = {
        type: message.type,
        sdp: message.sdp
    }
    // if we get an offer, we need to reply with an answer
    if (message.type == "offer") {
        //将新来的添加到成员列表
        start(message.form, 0, sdp);
    } else {
        var desc = new SessionDescription(sdp);
        console.log(desc);
        console.log("===========addAnswerSDP====================");
        console.log("========pcid " + pcid + " +=====================");
        //pcid
        peer[0].setRemoteDescription(desc, onSdpSuccess, onSdpError);
    }
});
signalingChannel.on("createAnswer", function (message) {
    console.log(message);
    var sdp = {
        type: message.type,
        sdp: message.sdp
    }
    // if we get an offer, we need to reply with an answer
    if (message.type == "offer") {
        //将新来的添加到成员列表
        start(message.target, 0, sdp);
    } else {
        var desc = new SessionDescription(sdp);
        console.log(desc);
        console.log("===========addAnswerSDP====================");
        console.log("========pcid " + 0 + " +=====================");
        //pcid
        peer[0].setRemoteDescription(desc, onSdpSuccess, onSdpError);
    }
});


//========================================================


// call start() to initiate
function start(target, targetPcid, offersdp) {
    console.log("start------>target::" + target + "   targetPcid::" + targetPcid + "   peer.length::" + peer.length);
    var channel;
    var pc = new PeerConnection({"iceServers": [{"url": "stun:stun.l.google.com:19302"}]});
    var pcid = peer.length;
    peer[peer.length] = pc;


    // send any ice candidates to the other peer
    pc.onicecandidate = function (event) {
        console.log("pc.onicecandidate");
        if (event.candidate) {
            var sendMessage = {
                candidate: event.candidate.candidate,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                sdpMid: event.candidate.sdpMid,
                targetPcid: targetPcid ? targetPcid : 0,
                fromPcid: pcid
            }
            console.log(sendMessage);
            signalingChannel.emit("onicecandidate", sendMessage);
        }
    };

    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
        console.log("pc.onnegotiationneeded");
    };

    if (offersdp) {
        openAnswererChannel(target);
    } else {
        openOffererChannel(target);
    }


    function openOffererChannel(target) {

        channel = pc.createDataChannel('RTCDataChannel', moz ? {} : {
            reliable: false // Deprecated
        });

        if (moz)
            channel.binaryType = 'blob';

        setChannelEvents(target);
        createOffer(target);
    }


    function openAnswererChannel(target) {
        console.log("===========openAnswererChannel============");

        pc.ondatachannel = function (event) {
            channel = event.channel;
            if (moz)
                channel.binaryType = 'blob';
            setChannelEvents(target);
        };

        //if (!moz) return;
        createAnswer(target);
    }
    function createOffer(target) {
        console.log("==========createOffer====================");
        pc.createOffer(function (sessionDescription) {
            pc.setLocalDescription(sessionDescription);

            var sendMessage = {
                type: sessionDescription.type,
                sdp: sessionDescription.sdp,
                target: target,
                from: id
            }

            console.log("signalingChannel.send");
            console.log(sendMessage);
            signalingChannel.emit("createOffer", sendMessage);

        }, onSdpError);
    }
    function createAnswer(target) {
        console.log("==========createAnswer====================");
        console.log(offersdp);

        pc.setRemoteDescription(new SessionDescription(offersdp), onSdpSuccess, onSdpError);
        pc.createAnswer(function (sessionDescription) {
            //sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
            pc.setLocalDescription(sessionDescription);
            console.log(sessionDescription);
            var sendMessage = {
                type: sessionDescription.type,
                sdp: sessionDescription.sdp,
                target: target,
                from: id
            }
            console.log("signalingChannel.send");
            console.log(sendMessage);

            signalingChannel.emit("createAnswer", sendMessage);
        }, onSdpError);
    }


    function setChannelEvents(target) {
        channel.onmessage = function (event) {
            console.log('WebRTC DataChannel onmessage', event);
        };

        channel.onopen = function () {
            var channelObj = {
                channel: channel,
                target: target
            }
            RTCDataChannels[RTCDataChannels.length] = channelObj;

            console.log("====ONOPEN====ONOPEN====ONOPEN====ONOPEN====ONOPEN====");
        };
        channel.onclose = function (event) {
            console.warn('WebRTC DataChannel closed', event);
        };
        channel.onerror = function (event) {
            console.error('WebRTC DataChannel error', event);
        };
    }
}

function onSdpSuccess(e) {
    console.log("onSdpSuccess");
    console.log(e);
}
function onSdpError(e) {
    console.log("onSdpError");
    console.error(e);
}


function channelSend(data) {
    var length = RTCDataChannels.length;

    for (var i = 0; i < length; i++) {
        var channel = RTCDataChannels[i].channel;
        if (channel.readyState == 'open') {
            channel.send(JSON.stringify(data));
        }
    }
}
//=============================================
