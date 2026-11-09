import { notFound } from "next/navigation";
import { getAiConfig, getMessages, getOwnedProject, getPlan, getSections, isDiscoveryDone } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Editor } from "./editor";

// Reads the local SQLite DB; blocking render keeps content fresh on every visit.
export const instant = false;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) notFound();

  const project = getOwnedProject(user.id, projectId);
  if (!project) notFound();

  const sections = getSections(project.id);

  return (
    <Editor
      project={project}
      initialSections={Object.fromEntries(sections.map((s) => [s.key, s.content_md]))}
      initialMessages={getMessages(project.id)}
      aiReady={Boolean(getAiConfig(user.id).api_key)}
      plan={getPlan(project.id)}
      discoveryDone={isDiscoveryDone(project.id)}
    />
  );
}
