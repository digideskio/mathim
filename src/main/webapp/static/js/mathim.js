$(document).ready(function() {
  var emailLink = '<a h'+'ref="m'+'ailt'+'o:'+
    '%74%6f%6d%6d%79%63%6c%69%40%75%63%6c%61%2e%65%64%75">'+
    '&#67;&#111;&#110;&#116;&#97;&#99;&#116;<\/a>';

  $("#email").html(emailLink);
});

reDoubleDol = new RegExp('\\\$\\\$', 'mg');

// define mathFilter
function mathFilter(msg)
{
  var regex = /(<([^>]+)>)/ig;
  var msg = msg.replace(regex, "");

	// Process double dollar signs, then tokenize rest of string by dollar
  var msgary = msg.replace(reDoubleDol, '&#36;').split('$');

  var newmsg = "";
  // iterate through
  for(var i = 0; i < msgary.length; ++i)
  {
    // even elements are not latex
    if(i%2 == 0)
    {
      newmsg = newmsg + msgary[i];
    }
    else
    {
      newmsg = newmsg + texify(msgary[i]);
    }
  }

	return newmsg;
}

// define mathFilter
function texify(tex)
{
  if(tex == "") {
    return "";
  } else {
    // escape single quotes with slash since embedding it into html
    var mathmlTag = '<script type="math/tex">' + tex + '</script>';
    return mathmlTag;
  }
}
