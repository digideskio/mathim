// initialize sound
soundManager.url = '/static/swf/';
soundManager.useFlashBlock = false;

// Last time IsTyping message was sent. In ms since epoch.
var lastIsTypingTime = 0;
var isTypingInterval = 2000;
var isTypingRemoval = 4000;
var isTypingMap = {};

soundManager.onready(function() {
  soundManager.createSound({
    id: 'notify',
    url: '/static/snd/sound_1.mp3'
  });
});

var pageTitle = "MathIM: LaTeX web-based chat";
function setChannelName(cN) {
  pageTitle = "MathIM: " + cN;
  $('#channelName').text(cN);
}

var playSounds = true;

function logAtBottom() {
  var chatLog = $('#chatLog');
  return chatLog[0].scrollHeight - chatLog.scrollTop() <= 
         chatLog.outerHeight() + 10; // give 10px for 'close enough'
}

function logScrollToBottom() {
  var chatLog = $('#chatLog');
  chatLog.scrollTop(chatLog[0].scrollHeight);
}

function addToLog(html, prepend) {
  var atBottom = logAtBottom();

  if(prepend) {
    $('#chatLog').prepend(html);
  } else {
    $('#chatLog').append(html);
  }
  
  if (atBottom)
    logScrollToBottom();
  
  if(playSounds && soundManager && soundManager.ok()) {
    soundManager.play('notify');
  }
}

var timestampHidden = false;
function timestampSpan() {
  if (timestampHidden) {
    return "<span class='timestamp' style='display:none;'>";
  } else {
    return "<span class='timestamp'>";
  }
}

function sysMessage(timestamp, message, prepend) {
  var html = "<p class='message sysMessage'>" +
             timestampSpan() + timestamp + "</span> " +
             "* " + message + "</p>\n";
  
  addToLog(html, prepend);
}

function chatMessage(timestamp, nick, message, prepend) {
  var mathedMsg = mathFilter(message);
  var html = "<p class='message chatMessage'>" +
             timestampSpan() + timestamp + "</span> " +
             "&lt;" + nick + "&gt; " + mathedMsg + "</p>\n";
  
  addToLog(html, prepend);
  MathJax.Hub.Update();
  
  if (nick in isTypingMap) {
    isTypingMap[nick] = 0;
    cleanStaleIsTypings();
  }
}

function isTypingMessage(nick) {
  if (nick in isTypingMap) {
    isTypingMap[nick] = (new Date()).getTime();
    return;
  }

  var atBottom = logAtBottom();

  var html = "<p class='message isTypingMessage' id='is-typing-" + nick + "'>" +
             nick + " is typing...</p>\n";
  $('#chatLog').append(html);
  
  isTypingMap[nick] = (new Date()).getTime();
  setTimeout(cleanStaleIsTypings, isTypingRemoval + 100); // grace period
    
  if (atBottom)
    logScrollToBottom();
}

function cleanStaleIsTypings() {
  var atBottom = logAtBottom();

  var now = (new Date()).getTime();
  for (var nick in isTypingMap) {
    if (isTypingMap[nick] < now - isTypingRemoval) {
      delete isTypingMap[nick];
      $('p#is-typing-'+nick).remove();
    }
  }
  
  if (atBottom)
    logScrollToBottom();
}

function initializeTopButtons() {
  $('#btnSound').click(function() {
    playSounds = !playSounds;
  });
  
  $('#btnTimestamps').click(function() {
    $('.timestamp').toggle();
    timestampHidden = !timestampHidden;
  });
  
  var userlistHidden = false;
  $('#btnUserlist').click(function() {
    if(userlistHidden) {
      $('#chatUserlist').show();
    } else {
      $('#chatUserlist').hide();
    }
    userlistHidden = !userlistHidden;
  });
}

function initializeChatInput() {
  var initialTextCleared = false;
  
  $('#composeTextarea').keypress(function(e) {
    initialTextCleared = true;
    
    var DOM_VK_RETURN = 13;
    if(e.which == DOM_VK_RETURN && !e.shiftKey) {
      if($('#composeTextarea').val() != "") {
        $('#composeSubmitBtn').click();
        MathJax.Hub.Update();
      }
      return false;
    }
  });
  
  $('#composeSubmitBtn').click(function() {
    setTimeout("$('#composeTextarea').val('').focus();", 10);
    MathJax.Hub.Update();
  });
  
  function updatePreview() {
    $('#previewArea').html(mathFilter($('#composeTextarea').val()));
  }
  
  $('#composeTextarea').keyup(function(e) {
    var DOM_VK_RETURN = 13;   
    if (e.which == DOM_VK_RETURN && !e.shiftKey) {
      lastIsTypingTime = 0;
      return;
    }
    
    var now = (new Date()).getTime();
    if ((now - lastIsTypingTime) > isTypingInterval) {
      sendIsTyping();
      lastIsTypingTime = now;
    }
  
    updatePreview();
    MathJax.Hub.Update();
  })
  
  // Move "input text" over
  updatePreview();
  
  //$('#composeTextarea').focus().select();
  setTimeout("$('#composeTextarea').focus().select();", 50);
  initTexbar(true, '#composeTextarea');
}

