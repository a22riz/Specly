import { notFound } from "next/navigation";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { Editor } from "./editor";

// Reads the local SQLite DB; blocking render keeps content fresh on every visit.
export const instant = false;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) notFound();

  const project = getProject(projectId);
  if (!project) notFound();

  const sections = getSections(project.id);

  return (
    <Editor
      project={project}
      initialSections={Object.fromEntries(sections.map((s) => [s.key, s.content_md]))}
      aiReady={Boolean(getAiConfig().api_key)}
    />
  );
}
