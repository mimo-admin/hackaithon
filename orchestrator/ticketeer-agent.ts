import { Agent } from "@/orchestrator/agent";
import {
  ActionType,
  AgentType,
  AuthActionParams,
  Next,
  State,
  Task,
} from "@/orchestrator/model";
import { LinearClient } from "@linear/sdk";
import { ChatCompletionRequestMessage } from "openai";

const systemPrompt: ChatCompletionRequestMessage = {
  role: "system",
  content: `Pretend you are a project manager. 
  Create a list of tasks to assign to your team in order to 
  build out the feature in the given Product Requirements Document.
  Your output must be in this format: [{task1}, {task2}, {task3}, ...].
  Each task is structured like so:
  {
    "name": "task name",
    "description": "task description",
    "assignee": "assignee name",
    "due_date": "due date"
  }`,
};

export class TicketeerAgent extends Agent {
  async act(state: State): Promise<Next> {
    if (state.tasks === undefined) {
      const prdPrompt: ChatCompletionRequestMessage = {
        role: "user",
        content: `Here is the Product Requirements Document for the feature:\n${state.prd}`,
      };

      const userPrompt: ChatCompletionRequestMessage = {
        role: "user",
        content:
          "Please write as many tasks as you can think of to build out this feature and respond in the required format!",
      };

      const response = await this.chat({
        model: "gpt-3.5-turbo",
        messages: [systemPrompt, prdPrompt, userPrompt],
        temperature: 0.0,
        maxTokens: 1000,
      });
      console.log(response);
      if (!response) {
        throw new Error("No response from OpenAI API");
      }
      const tasks: Task[] = JSON.parse(response);
      console.log(tasks);
      state.tasks = tasks;

      return {
        agent: AgentType.TICKETEER,
      };
    } else if (state.next?.external_prompt?.response === undefined) {
      return {
        agent: AgentType.TICKETEER,
        external_prompt: {
          request: {
            type: ActionType.AUTH,
          },
        },
      };
    } else {
      const params = state.next.external_prompt.response
        .params as AuthActionParams;
      const linearClient = new LinearClient({
        accessToken: params.accessToken,
      });

      for (const task of state.tasks) {
        const issue = await linearClient.createIssue({
          teamId: "team-id",
          projectId: "project-id",
          title: task.name || "",
          description: task.description || "",
        });
        console.log("Created issue!", issue);
      }

      return {
        agent: AgentType.END,
      };
    }
  }
}
