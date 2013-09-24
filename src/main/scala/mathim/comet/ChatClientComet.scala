package mathim.comet

import net.liftweb._
import http._
import http.js._
import http.js.JE._
import http.js.jquery.JqJsCmds._
import http.js.JsCmds._
import http.SHtml._
import util.Helpers._
import util.ActorPing
import net.liftweb.actor._
import net.liftweb.common.{Box, Full, Loggable}
import scala.xml._
import scala.util.Random
import java.util.Date
import mathim.lib._
import net.liftweb.json.JsonAST.JObject
import net.liftweb.json.JsonAST.JField
import net.liftweb.json.JsonAST.JString

object KeepAlive

object ChatLimits {
  val maxCharsPerSecond = 1024
  val maxStoredAllowance = 5*1024
  val minCostPerMessage = 512
  val onTypingCost = 512
  val warnKickPoint = -5*1024
  val kickPoint = -10*1024
}

class ChatClientComet extends CometActor with Loggable {
  val channelName = S.param("channelName").get
  
  val server = ChatServer
  
  var nickOpt : Option[String] = None
  
  override def lifespan = Full(20 seconds)
  
  def keepAliveInterval = 6000L

  LAPinger.schedule(this, KeepAlive, keepAliveInterval)
  
  var lastMessageTime: Long = 0 // Init to UNIX epoch
  var charAllowance: Long  = ChatLimits.maxStoredAllowance
  
  override def autoIncludeJsonCode = true

  def RateLimitingOk(size: Int) = {
    val now = (new Date()).getTime()

    val allowanceGained = 
      (now - lastMessageTime) * ChatLimits.maxCharsPerSecond / 1000

    charAllowance = 
      math.min(ChatLimits.maxStoredAllowance, charAllowance + allowanceGained)

    lastMessageTime = now

    charAllowance -= size

    charAllowance > 0
  }


  override def localSetup() = {
    server ! Subscribe(this, channelName)
  }
  
  override def localShutdown() = { 
    logger.info("localShutdown")
    server ! Unsubscribe(this, channelName, nickOpt)
  }
  
  override def lowPriority = {
    case NickTaken(nick) => {
      this.error("chatError", "Nick '" + nick + "' taken. Choose another.")
      reRender
    }
    case NickAssignment(nick) => {
      nickOpt = Some(nick)
      reRender
      this.error("chatError", "")
    }
    case ChannelLog(log) => {
      logger.info("ChannelLog received")
      if(!log.isEmpty)
        partialUpdate(log.reverse.map(m => jsCall(m, true)).reduceLeft(_+_))
      else
        Noop
    }
    case ChannelNicks(nicks) => {
      logger.info("ChannelNicks received")
      partialUpdate(SetHtml("chatUserlist", nicks.map(n => 
        <p class='message'>{n}</p>).toSeq))
    }
    case message: Message => {
      partialUpdate(jsCall(message))
    }
    case isTyping: IsTypingMessage => {
      if (nickOpt.getOrElse("") != isTyping.nick) {
        partialUpdate(jsCall(isTyping))
      }
    }
    case KeepAlive => {
      LAPinger.schedule(this, KeepAlive, keepAliveInterval);
      partialUpdate(JsCmds.Noop)
    } 
    case x => 
      logger.error("StarGameComet unknown message: %s".format(x.toString))
  }
  
  def jsCall(message: Any, prepend: Boolean = false) : JsExp = { 
    message match {
      case msg: ChatMessage => 
        Call("chatMessage", msg.timestampShort, msg.nick, msg.message, prepend) 
      case msg: SysMessage =>
        Call("sysMessage", msg.timestampShort, msg.message, prepend)
      case msg: IsTypingMessage =>
        Call("isTypingMessage", msg.nick)
    }
  }
  
  def showPanes(panes: List[String]) = {
    val cmd = "$('.pane').hide();" :: panes.map("$('#" + _ + "').show();") 
    OnLoad(JsRaw(cmd.mkString("\n")))
  }
  
  def render = {
    if(nickOpt.isDefined) {
      setJsonCalls & renderCompose & showPanes("chatInputCompose" :: Nil)
    } else {
      renderAskName & showPanes("chatInputAskName" :: Nil)
    } & Call("setChannelName", channelName)
  }
  
  def setJsonCalls = {
    JsRaw("function sendIsTyping() {" +
      jsonSend("IsTyping", JsRaw("1")).toJsCmd +
    "}")
  }
  
  override def receiveJson = {
    //case x if {println("Got Json: "+x); false} => Noop
    case JObject(List(JField("command", JString("IsTyping")), 
                      JField("params", _))) => {
      if (RateLimitingOk(ChatLimits.onTypingCost)) {
        server ! IsTypingMessage(channelName, nickOpt.get)
      } else {
        rateLimitWarn()
      }
      Noop
    }
  }
  
  def rateLimitWarn() = {
	val warningMsg = 
	  "Rate limit exceeded. %d characters in debt."
	    .format(-charAllowance)
	this ! SysMessage(warningMsg)
	
	if(charAllowance < ChatLimits.warnKickPoint) {
	  this ! SysMessage("Kicking soon.")
	}
	if(charAllowance < ChatLimits.kickPoint) {
	  this ! SysMessage("Kicked.")
      this ! ShutDown
    }
  }
   
  def renderCompose = OnLoad(SetHtml("chatInputCompose", 
    S.runTemplate("templates-hidden" :: "chatCompose" :: Nil, 
      "composetextarea" -> {
        SHtml.onSubmit(msg => {
          val cost = math.max(ChatLimits.minCostPerMessage, msg.length)
          if (RateLimitingOk(cost))
            server ! ChatMessage(channelName, nickOpt.get, msg)
          else 
            rateLimitWarn()
        })
      }
    ) match {
      case Full(x) => x
      case _ => <p>Problem rendering compose</p>
    }
  ) & Call("initializeChatInput"))
  
  def renderAskName = OnLoad(SetHtml("chatInputAskName", nickOpt match {
    case Some(name) => <p>Nick registered</p>
    case x => {      
      def processNick(nick: String) = {
        server ! RequestNick(this, channelName, nick)
        Noop
      }
      
      ajaxForm(
        <div>
          Choose a nickname
          <br/>
          {text("", processNick, "class"->"askNameTextField")}
          {ajaxSubmit("Join", () => Noop)} 
        </div>
      )
    }
  }) & JsRaw("$('.askNameTextField').focus();"))
  
}

