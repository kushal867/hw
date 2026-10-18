import { SiteFooter, SiteHeader } from "@/components/site-header";
export const metadata = { title: "About" };
export default function About() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>About EduSathi</h1>
    <p>EduSathi (“study friend”) makes studying easier by giving students one organised place to access notes, share homework, discuss academic problems, and prepare for exams together.</p>
    <p>Every semester is a private digital classroom with a shared bookshelf and a student discussion community. EduSathi is free to use at launch and designed first for students in Nepal.</p>
  </main><SiteFooter /></>);
}
