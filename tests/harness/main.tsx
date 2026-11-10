import { render } from "preact";
import { App } from "../../src/app/App";
import type {
  CourseAdapter,
  CourseSnapshot,
  ResourceRecord,
} from "../../src/platform/xiaoya/types";
import { courseFixture, orderingCourseFixture } from "../fixtures/course";
import { createMinimalPdf } from "../fixtures/pdf";
import { createMinimalPptx } from "../fixtures/pptx";
import { exerciseHtml } from "../fixtures/exercises";

class FixtureAdapter implements CourseAdapter {
  constructor(private readonly course: CourseSnapshot) {}
  getCourseId(): string {
    return this.course.courseId;
  }
  async loadCourse(): Promise<CourseSnapshot> {
    return this.course;
  }
  async resolveResourceUrl(resource: ResourceRecord): Promise<string> {
    return `https://course.ai-augmented.com/fixture/${resource.id}`;
  }
  async resolveVideoPlayback(resource: ResourceRecord) {
    return {
      url: "data:video/mp4;base64,AAAA",
      kind: "mp4" as const,
      expiresAt: null,
      requiresPlatformAuth: false,
      fallbackPlatformUrl: `https://course.ai-augmented.com/fixture/${resource.id}`,
    };
  }
  async fetchResourceBytes(resource: ResourceRecord): Promise<ArrayBuffer> {
    if (resource.kind === "pdf") return createMinimalPdf(30);
    if (resource.kind === "presentation") return createMinimalPptx();
    if (resource.kind === "exercise")
      return new TextEncoder().encode(exerciseHtml).buffer as ArrayBuffer;
    if (resource.kind === "image") {
      const png = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=",
        ),
        (character) => character.charCodeAt(0),
      );
      return png.buffer as ArrayBuffer;
    }
    return new TextEncoder().encode(`Fixture resource ${resource.id}`).buffer as ArrayBuffer;
  }
}

const selectedCourse = new URLSearchParams(window.location.search).get("ordering")
  ? orderingCourseFixture
  : courseFixture;
render(
  <App adapter={new FixtureAdapter(selectedCourse)} initialCourse={selectedCourse} />,
  document.getElementById("app")!,
);
