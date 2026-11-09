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
};
