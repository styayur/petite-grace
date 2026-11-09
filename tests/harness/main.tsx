import { render } from "preact";
import { App } from "../../src/app/App";
import type {
  CourseAdapter,
  CourseSnapshot,
  ResourceRecord,
} from "../../src/platform/xiaoya/types";
import { courseFixture } from "../fixtures/course";

class FixtureAdapter implements CourseAdapter {
  getCourseId(): string {
    return courseFixture.courseId;
  }
  async loadCourse(): Promise<CourseSnapshot> {
    return courseFixture;
  }
  async resolveResourceUrl(resource: ResourceRecord): Promise<string> {
    return `data:application/octet-stream;base64,${btoa(`fixture:${resource.id}`)}`;
  }
  async fetchResourceBytes(resource: ResourceRecord): Promise<ArrayBuffer> {
    const bytes = new TextEncoder().encode(`Fixture resource ${resource.id}`);
    return bytes.buffer;
  }
}

render(
  <App adapter={new FixtureAdapter()} initialCourse={courseFixture} />,
  document.getElementById("app")!,
);
