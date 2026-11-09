// HandsFree site settings. Everything that is still undecided lives here,
// so the page itself never has to change when a decision is made.
// Anything left as null stays hidden or shows a "not yet" state.

window.HANDSFREE_CONFIG = {
  // Where the "Get involved" form sends sign-ups (POST, JSON body:
  // { name, email, interests: [...], note, source }). Not chosen yet.
  signupEndpoint: null,

  // If there is no endpoint, the form opens a pre-filled email to this address.
  contactEmail: null,

  // The early build for friends: the app, not the source code.
  // Example: { url: "https://…/HandsFree-0.1.dmg", label: "Download for macOS", note: "v0.1 · friends preview" }
  download: null,

  // Shown in the footer only once the repo is public.
  githubUrl: null,

  // Neel's videos. Each item: { title, youtubeId } or { title, src, poster }.
  videos: [],

  // A video for the top of the page (e.g. from the video agent). When set, it
  // replaces the drawn desk scene. Example: { src: "hero.mp4", poster: "hero.jpg" }
  heroVideo: null,

  // The executive's day shown in the desk scene. Minutes per day, an illustrative
  // estimate built from published studies (see "Where these numbers come from" on the page).
  day: {
    apps: [
      { name: "Email", icon: "mail", min: 140 },
      { name: "Meetings", icon: "video", min: 120 },
      { name: "Word & PowerPoint", icon: "file", min: 90 },
      { name: "Slack & Teams chat", icon: "message", min: 75 },
      { name: "ChatGPT", icon: "sparkles", min: 35 },
      { name: "Claude", icon: "sparkles", min: 25 },
      { name: "Calendar", icon: "calendar", min: 20 },
      { name: "Google search", icon: "search", min: 15 },
    ],
    // How that time is spent, by the way you talk to the machine.
    inputs: { reading: 190, keyboard: 65, mouse: 110, phone: 40, voice: 5 },
    appSwitches: 1200,
  },
};
