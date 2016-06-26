/**
 * Created by sulvto on 16-1-31.
 */
window.moz = !!navigator.mozGetUserMedia;
var userMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);

var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection ||
        window.webkitRTCPeerConnection || window.msRTCPeerConnection,

    SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription ||
        window.webkitRTCSessionDescription || window.msRTCSessionDescription,

    IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;

window.answerer = [];
window.offerer = [];
window.localMediaStream = null;

var RTCDataChannels = [];
var id = null;
var signalingChannel = io();
var SOCKET = {
    sendOfferSdp: function (offerSdp, target) {
        signalingChannel.emit("RTCDataChannel", {offerSdp: offerSdp, from: window.ID, target: target});
    },
    sendAnswerSdp: function (answerSdp, target) {
        signalingChannel.emit("RTCDataChannel", {answerSdp: answerSdp, from: window.ID, target: target});
    },
    sendIce: function (ice, target) {
        signalingChannel.emit("RTCDataChannel", {ice: ice, from: window.ID, target: target});
    }
}

signalingChannel.on("RTCDataChannel", function (data) {
    if (data.from == window.ID) {
        console.log("from me", data);
        return;
    }
    var nowDate = new Date();

    if (data.target == window.ID) {
        // if other user created offer; and sent you offer-sdp
        if (data.offerSdp) {
            if (!window.answerer[data.from]) {
                console.log("====offerSdp====" + nowDate.toLocaleTimeString() + " " + nowDate.getMilliseconds(), window.answerer);
                window.answerer[data.from] = {peer: Answerer.createAnswer(data.offerSdp, data.from)};
            }
        } else
        // if other user created answer; and sent you answer-sdp
        if (data.answerSdp) {
            if (window.offerer[data.from]) {
                console.log("====answerSdp====" + nowDate.toLocaleTimeString() + " " + nowDate.getMilliseconds(), window.offerer);
                window.offerer[data.from].peer.setRemoteDescription(data.answerSdp);
            }
        } else
        // if other user sent you ice candidates
        if (data.ice) {
            // it will be fired both for offerer and answerer
            if (window.answerer[data.from]) {
                console.log("====ice answerer====" + nowDate.toLocaleTimeString() + " " + nowDate.getMilliseconds(), window.answerer);
                window.answerer[data.from].peer.addIceCandidate(data.ice);
            } else if (window.offerer[data.from]) {
                console.log("====ice offerer====" + nowDate.toLocaleTimeString() + " " + nowDate.getMilliseconds(), window.offerer);
                window.offerer[data.from].peer.addIceCandidate(data.ice);
            }
        } else {

        }
    } else if (!data.target) {
        if (!window.answerer[data.from]) {
            console.log("====  createOffer   ====" + nowDate.toLocaleTimeString() + " " + nowDate.getMilliseconds());
            window.offerer[data.from] = {peer: Offerer.createOffer(data.from)};
        }
    }
});

signalingChannel.emit("ID", {});

signalingChannel.on("ID", function (data) {
    window.ID = data.replace("/#", "");
    $("#panel .panel-title").text(ID);
});


//========================================================
var iceServers = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

function failureCallback(data) {
    //TODO error
    console.log(data);
}
var Offerer = {
    createOffer: function (target) {
        var peer = new PeerConnection(iceServers);
        peer.addStream(window.localMediaStream);

        // send any ice candidates to the other peer
        peer.onicecandidate = function (event) {
            console.log("peer.onicecandidate");
            if (event.candidate) {
                SOCKET.sendIce(event.candidate, target);
            }
        };

        // let the "negotiationneeded" event trigger offer generation
        peer.onnegotiationneeded = function () {
            console.log("peer.onnegotiationneeded");
        };

        var offererDataChannel = peer.createDataChannel('RTCDataChannel', moz ? {} : {
            reliable: false // Deprecated
        });
        if (moz) {
            offererDataChannel.binaryType = 'blob';
        }
        setChannelEvents(offererDataChannel);
        peer.createOffer(function (sdp) {
            peer.setLocalDescription(sdp);
            SOCKET.sendOfferSdp(sdp, target);
        }, failureCallback);
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
    createAnswer: function (offerSDP, target) {
        var peer = new PeerConnection(iceServers);
        peer.addStream(window.localMediaStream);

        peer.ondatachannel = function (event) {
            var answererDataChannel = event.channel;
            if (moz) {
                answererDataChannel.binaryType = 'blob';
            }

            setChannelEvents(answererDataChannel);
        };

        peer.onaddstream = function (event) {
            console.log("channel.onaddstream", event);
            attachStream(event.stream, target)
        };

        peer.onicecandidate = function (event) {
            if (event.candidate) {
                SOCKET.sendIce(event.candidate, target);
            }
        };

        peer.setRemoteDescription(new SessionDescription(offerSDP));

        peer.createAnswer(function (sdp) {
            peer.setLocalDescription(sdp);
            SOCKET.sendAnswerSdp(sdp, target);
        }, failureCallback);


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
        onMsg(event.data);
    };

    channel.onopen = function () {
        console.log(channel);
        RTCDataChannels[RTCDataChannels.length] = channel;

        //TODO
        console.log("====ONOPEN====ONOPEN====ONOPEN====ONOPEN====ONOPEN====");
    };

    channel.onclose = function (event) {
        console.warn('WebRTC DataChannel closed', event);
    };
    channel.onerror = function (event) {
        console.error('WebRTC DataChannel error', event);
    };
}

function attachStream(stream, id) {
    var newVideo = document.createElement("video");
    newVideo.setAttribute("class", "other");
    newVideo.setAttribute("autoplay", "autoplay");
    newVideo.setAttribute("id", "other-" + id);
    document.getElementById("videos").appendChild(newVideo);

    if (window.moz) {
        newVideo.mozSrcObject = stream;
        newVideo.play();
    }
    newVideo.src = URL.createObjectURL(stream);
}

function channelSend(data) {
    var length = RTCDataChannels.length;

    for (var i = 0; i < length; i++) {
        var channel = RTCDataChannels[i];
        if (channel.readyState == 'open') {
            channel.send(data);
        }
    }
}

//=====================================================================
$("#input").keyup(function (data) {
    //Enter
    if (data.keyCode == 13) {
        sendMsg();
    }
});

//TODO temp
var start = window.setInterval(function () {
    if (window.ID) {
        var nowDate = new Date();
        console.log("====  send from   ====" + nowDate.getMinutes() + " " + nowDate.getMilliseconds());

        signalingChannel.emit("RTCDataChannel", {from: window.ID});
        clearInterval(start);
    }
}, 3000);

function showMsgToPanel(message, me) {
    if (me) {
        $("#panel .panel-body").append("<p class='text-right'>" + message + "</p>");
    } else {
        $("#panel .panel-body").append("<p class='text-left'>" + message + "</p>");
    }
    $("#panel .panel-body").scrollTop(Number.MAX_VALUE);
}

function onMsg(msg) {
    if (msg) {
        showMsgToPanel(msg, false);
    }
}
function sendMsg() {
    var msg = $("#input").val();
    channelSend(msg);
    showMsgToPanel(msg, true);
    $("#input").val("");
}

window.setInterval(function () {
    console.log("RTCDataChannels :: " + RTCDataChannels.length);
}, 10000);


userMedia.call(navigator, {video: true, audio: true},
    function (stream) {
        window.localMediaStream = stream;
        //document.getElementById('me').src = URL.createObjectURL(stream);
        //document.getElementById('me').play();
    },
    function (error) {
        console.log(error);
    });
