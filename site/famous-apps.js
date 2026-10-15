// Same data as famous-apps.json, as a script so the page works opened from a file (AIG-842).
window.FAMOUS_APPS = {
 "checked": "2026-10-14",
 "note": "Only numbers confirmed on the linked page. Anything not confirmed is left out.",
 "apps": [
  {
   "id": "vscode",
   "name": "VS Code",
   "line": "First preview a few months after work began (Build 2015). On GitHub: 256,109 issues and 68,693 pull requests, as of 14 Oct 2026.",
   "sources": [
    "https://code.visualstudio.com/blogs/2016/04/14/vscode-1.0",
    "https://api.github.com/search/issues?q=repo:microsoft/vscode+is:issue",
    "https://api.github.com/search/issues?q=repo:microsoft/vscode+is:pr"
   ]
  },
  {
   "id": "discord",
   "name": "Discord",
   "line": "Studio started April 2012; first version of the chat app out in May 2015, built on what the team learned making a game.",
   "sources": ["https://discord.com/company"]
  },
  {
   "id": "slack",
   "name": "Slack",
   "line": "Began as a tool inside a game studio; launched to the public in August 2013.",
   "sources": [
    "https://venturebeat.com/2013/08/15/flickr-founder-stewart-butterfields-new-slack-signed-up-8000-companies-in-24-hours/",
    "https://en.wikipedia.org/wiki/Slack_(software)"
   ]
  },
  {
   "id": "instagram",
   "name": "Instagram",
   "line": "Several months of prototyping, then launched 6 Oct 2010 with a team of four a month later and about a dozen when Facebook bought it.",
   "sources": [
    "https://techcrunch.com/2012/04/09/instagram-story-facebook-acquisition/",
    "https://techcrunch.com/2010/10/06/instagram-launch/",
    "https://techcrunch.com/2010/11/17/instagram-twitter-office/"
   ]
  },
  {
   "id": "whatsapp",
   "name": "WhatsApp",
   "line": "By its 2014 sale, 32 engineers served about 14 million active users each. Launch date and launch team size not confirmed, so left out.",
   "sources": ["https://sequoiacap.com/article/four-numbers-that-explain"]
  }
 ]
}
;
