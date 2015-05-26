README: Visualizer addon for ScriptInspector

<b> Warning: ScriptInspector is a fork of <em>Windows</em> version Firefox that DOES NOT RUN on Linux/MacOS. </b>

To download the ScriptInspector, click <a href="http://www.cs.virginia.edu/yuchen/oakland15/packaged/ScriptInspector.rar">here</a>.

To download the visualizer extension, click <a href="http://www.cs.virginia.edu/yuchen/oakland15/packaged/visualizer.xpi">here</a>.

1) ScriptInspector (A modification of Mozilla Firefox Nightly, retrieved on 2014-06-03, version number 32.0a1 (2014-11-05)) requires Windows 7/8, .NET framework, and Visual Studio 2013 redist package to run.  Please note that you need to install both x86 and x64 packages for VS2013 redist.  These packages are small (<10MB each) to download and install.  If you downloaded a larger version, chances are that you are installing a wrong package.  If you are getting 'missing MSVCR120.dll' error, it is due to the incorrect setup of redist packages.

2) If you are a regular Firefox user, you may want to set up a separate Firefox profile to use ScriptInspector.  Please see step 3 for the reason.  

3) ScriptInspector does not have good compatibility with Flash plugin.  This is possibly due to a bug in addon-sdk and this particular version of Mozilla Nightly.  Please disable Adobe Flash plugin (ideally, any plugin that you think may be causing trouble) when using ScriptInspector.  Also note that enabling plugins does not guarantee to crash/freeze the browser, but is highly likely to do so, especially on complicated sites.

4) For dynamic sites that embed lots of JavaScripts, ScriptInspector will likely freeze up for several/tens of seconds.  This is normal, and please wait patiently before the browser becomes responsive again to click any buttons.  The performance issue is due to various hooks and recording code added to the security-critical APIs.

4) Once you are able to navigate and browse a complicated site (say, nytimes.com) with ScriptInspector without problems (other than slow performance), go ahead and drag Visualizer.xpi into ScriptInspector.  A sidebar will appear after successful installation of Visualizer extension.

5) Follow instructions on the extension sidebar to display all resource accesses on the page.  Click to expand or collapse the individual third-party domains and their access categories.  Mouse over the individual accesses to highlight the elements on the page.  When mousing over any access, pink color indicates that the element is visible, purple indicates invisible.  Clicking on a pink entry will auto-scroll the page to bring that element into view.  Clicking on a purple entry will pop up an alert window displaying the content of that node.  Green entries denotes third-party owned nodes, and are often advertisements and social widgets inserted into the page.  Again, follow instructions on the sidebar to output all accesses of all third-party scripts as a text file (named the URL of this page) to the current profile directory.

6) For policy generation, follow these steps:

7) Create a \policies folder under the same drive as you put ScriptInspector.  Create an \extra folder inside the \policies folder.

	For example, you put ScriptInspector under D:\test\ScriptInspector
	Then, you should create D:\policies and D:\policies\extra
	
8) The \policies folder should contain the base policies for third-party scripts, the extra folder contains site-specific policies:
	For example, in D:\policies, you have:
		D:\policies\googleadvertising.com.txt   						-> base policies for googleadvertising.com scripts
	Then, to create site-specific policies googleadvertising for nytimes.com, you should have:
		D:\policies\extra\nytimes.com\googleadvertising.com.txt 		-> site-specific policies for nytimes.com

	You don't have to worry about site-specific policies as Visualizer should be able to generate them for you. For base policies though, you need to create them yourselves.
	
	(*) If you don't have base policy for A_domain, i.e. A_domain.com.txt under \policies folder, ScriptInspector will not output any violations with regard to that domain.  If you want it to check violations, at least put an empty file with the name of A_domain.com.txt.

9) Follow the instructions on the sidebar to invoke the policyGenerator for domains with violating accesses.  Note that the PolicyGenerator will not run for domains without a base policy (an empty base policy file is required even when no base policy is necessary) or violating accesses.

10) Generated policies are going to be stored in \policies folder.

---

Known issues: 

	a) When suggesting permission that involves elements with multiple classes, visualizing function won't work on those elements even if user clicks on that element.
	b) Resource accesses on host-owned elements with ':' in their node name (such as xml:div) will trigger an error that pops up an alert window.  Feel free to click "prevent this page from poping-up alerts in the future" to suppress this bug.