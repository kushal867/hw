"use client";
import { useState } from "react";

type College = { id: string; name: string };
type Course = { id: string; name: string; college_id: string };
type Semester = { id: string; semester_number: number; academic_year?: string | null; course_id: string };

/**
 * Linked College → Course → Semester selects: each list only offers options that belong to the choice above it,
 * and changing a parent clears the children. Renders three grid cells so it drops into any form grid.
 * The server re-checks the same relationships; this component is only the convenience layer.
 */
export function AcademicPicker({ colleges, courses, semesters, initial, required = false, names = { college: "college_id", course: "course_id", semester: "semester_id" } }: {
  colleges: College[]; courses: Course[]; semesters: Semester[];
  initial?: { college?: string | null; course?: string | null; semester?: string | null };
  required?: boolean; names?: { college: string; course: string; semester: string };
}) {
  const startSem = semesters.find((s) => s.id === initial?.semester);
  const startCourse = courses.find((c) => c.id === (initial?.course ?? startSem?.course_id));
  const [college, setCollege] = useState(initial?.college ?? startCourse?.college_id ?? "");
  const [course, setCourse] = useState(startCourse?.id ?? "");
  const [semester, setSemester] = useState(startSem?.id ?? "");
  const myCourses = courses.filter((c) => c.college_id === college);
  const mySemesters = semesters.filter((s) => s.course_id === course).sort((a, b) => a.semester_number - b.semester_number);
  return (
    <>
      <div><label htmlFor={names.college} className="label">College</label>
        <select id={names.college} name={names.college} value={college} required={required} className="input"
          onChange={(e) => { setCollege(e.target.value); setCourse(""); setSemester(""); }}>
          <option value="">{required ? "Choose your college…" : "Not set"}</option>
          {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor={names.course} className="label">Course</label>
        <select id={names.course} name={names.course} value={course} required={required} disabled={!college} className="input"
          onChange={(e) => { setCourse(e.target.value); setSemester(""); }}>
          <option value="">{!college ? "Choose a college first" : myCourses.length ? (required ? "Choose your course…" : "Not set") : "No courses added yet"}</option>
          {myCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor={names.semester} className="label">Semester</label>
        <select id={names.semester} name={names.semester} value={semester} required={required} disabled={!course} className="input"
          onChange={(e) => setSemester(e.target.value)}>
          <option value="">{!course ? "Choose a course first" : mySemesters.length ? (required ? "Choose your semester…" : "Not set") : "No semesters added yet"}</option>
          {mySemesters.map((s) => <option key={s.id} value={s.id}>Semester {s.semester_number}{s.academic_year ? ` (${s.academic_year})` : ""}</option>)}</select></div>
    </>
  );
}
