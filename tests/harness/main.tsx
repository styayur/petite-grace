import { render } from "preact";
import { App } from "../../src/app/App";
import type {
  CourseAdapter,
  CourseSnapshot,
  ResourceRecord,
} from "../../src/platform/xiaoya/types";
import { courseFixture } from "../fixtures/course";
import { createMinimalPdf } from "../fixtures/pdf";
import { createMinimalPptx } from "../fixtures/pptx";

class FixtureAdapter implements CourseAdapter {
  getCourseId(): string {
    return courseFixture.courseId;
  }
  async loadCourse(): Promise<CourseSnapshot> {
    return courseFixture;
  }
  async resolveResourceUrl(resource: ResourceRecord): Promise<string> {
    return `https://course.ai-augmented.com/fixture/${resource.id}`;
  }
  async fetchResourceBytes(resource: ResourceRecord): Promise<ArrayBuffer> {
    if (resource.kind === "pdf") return createMinimalPdf(30);
    if (resource.kind === "presentation") return createMinimalPptx();
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

render(
  <App adapter={new FixtureAdapter()} initialCourse={courseFixture} />,
  document.getElementById("app")!,
);
