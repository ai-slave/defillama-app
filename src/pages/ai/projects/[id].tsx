import { LlamaAIShell } from '~/containers/LlamaAI/LlamaAIShell'
import { ProjectsSignInGate } from '~/containers/LlamaAI/projects/ProjectsSignInGate'

function ProjectDetailPage() {
	return <ProjectsSignInGate />
}

ProjectDetailPage.getLayout = LlamaAIShell.getLayout

export default ProjectDetailPage
