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
var id = null;
var SOCKET = {
    sendOfferSdp: function (offerSdp) {
        io().emit("RTCDataChannel", {offerSdp: offerSdp});
    },
    sendAnswerSdp: function (answerSdp) {
        io().emit("RTCDataChannel", {answerSdp: answerSdp});
    },
    sendIce: function (ice) {
        io().emit("RTCDataChannel", {ice: ice});
    }
}
io().on("RTCDataChannel", function (data) {
    console.log(data);
    // if other user created offer; and sent you offer-sdp
    if (data.offerSdp) {
        window.answerer = Answerer.createAnswer(data.offerSdp);
    }

    // if other user created answer; and sent you answer-sdp
    if (data.answerSdp) {
        window.offerer.setRemoteDescription(data.answerSdp);
    }

    // if other user sent you ice candidates
    if (data.ice) {
        // it will be fired both for offerer and answerer
        (window.answerer || window.offerer).addIceCandidate(data.ice);
    }
});


//========================================================
var iceServers = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
var offererDataChannel, answererDataChannel;

var Offerer = {
    createOffer: function () {
        var peer = new PeerConnection(iceServers);

        offererDataChannel = peer.createDataChannel('RTCDataChannel', moz ? {} : {
            reliable: false // Deprecated
        });
        setChannelEvents(offererDataChannel);
        // send any ice candidates to the other peer
        peer.onicecandidate = function (event) {
            console.log("pc.onicecandidate");
            if (event.candidate) {
                console.log(event.candidate);
                SOCKET.sendIce(event.candidate);
            }
        };

        // let the "negotiationneeded" event trigger offer generation
        peer.onnegotiationneeded = function () {
            console.log("pc.onnegotiationneeded");
        };

        peer.createOffer(function (sdp) {
            peer.setLocalDescription(sdp);
            SOCKET.sendOfferSdp(sdp);
        });
        this.peer = peer;
        return this;
    }, setRemoteDescription: function (sdp) {
        this.peer.setRemoteDescription(new SessionDescription(sdp));
    },
    addIceCandidate: function (candidate) {
        this.peer.addIceCandidate(new IceCandidate({
            sdpMLineIndex: candidate.sdpMLineIndex,
            candidate: candidate.candidate
        }));
    }
}

var Answerer = {
    createAnswer: function (offerSDP) {
        var peer = new PeerConnection(iceServers);
        peer.ondatachannel = function (event) {
            answererDataChannel = event.channel;
            setChannelEvents(answererDataChannel);
        };

        peer.onicecandidate = function (event) {
            if (event.candidate) {
                console.log(event.candidate);
                SOCKET.sendIce(event.candidate);
            }
        };

        peer.setRemoteDescription(new SessionDescription(offerSDP));

        peer.createAnswer(function (sdp) {
            peer.setLocalDescription(sdp);
            SOCKET.sendAnswerSdp(sdp);
        });

        this.peer = peer;
        return this;
    },
    addIceCandidate: function (candidate) {
        this.peer.addIceCandidate(new IceCandidate({
            sdpMLineIndex: candidate.sdpMLineIndex,
            candidate: candidate.candidate
        }));
    }
};

function setChannelEvents(channel) {
    channel.onmessage = function (event) {
        console.log('WebRTC DataChannel onmessage', event);
    };

    channel.onopen = function () {
        RTCDataChannels[RTCDataChannels.length] = channel;

        console.log("====ONOPEN====ONOPEN====ONOPEN====ONOPEN====ONOPEN====");
    };
    channel.onclose = function (event) {
        console.warn('WebRTC DataChannel closed', event);
    };
    channel.onerror = function (event) {
        console.error('WebRTC DataChannel error', event);
    };
}


var offerer = Offerer.createOffer();

function channelSend(data) {
    var length = RTCDataChannels.length;

    for (var i = 0; i < length; i++) {
        var channel = RTCDataChannels[i];
        if (channel.readyState == 'open') {
            channel.send(JSON.stringify(data));
        }
    }
}
//=============================================
