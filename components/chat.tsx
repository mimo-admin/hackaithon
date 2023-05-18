"use client";

import { AgentMessage } from "@/components/agent-message";
import { AgentThought } from "@/components/agent-thought";
import { Features } from "@/components/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMessage } from "@/components/user-message";
import { useStateContext } from "@/context/state";
import { ActionType, AgentType, State } from "@/orchestrator/model";
import { useState } from "react";
import { Tasks } from "./tasks";

const decoder = new TextDecoder();

// TODO: add somewhere we can add a password

export function Chat() {
  const { state, setState } = useStateContext();
  const [input, setInput] = useState<string>("");

  const traverse = async (event: any, newState?: State) => {
    event.preventDefault();
    if (newState === undefined) {
      return;
    }
    console.log("traversing!", newState);
    const response = await fetch("http://localhost:3000/api", {
      method: "POST",
      body: JSON.stringify({
        state: newState,
        password: "",
      }),
    });
    if (!response.body) {
      console.log("no body!");
      return;
    }
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("done!");
        return;
      }
      const decoded = decoder.decode(value);
      try {
        console.log(decoded);
        const decodedState: State = JSON.parse(decoded);
        setState(decodedState);
        console.log("state!", decodedState);
      } catch (e) {
        console.log("error parsing state!", e);
      }
    }
  };

  return (
    <main className="flex-1 overflow-y-auto my-4 rounded-sm border flex flex-col p-4 gap-4">
      <div className="flex flex-col flex-1 gap-4 overflow-y-auto">
        <AgentMessage content="Hello! I'm Raina, your AI product manager. How can I help you?" />
        {state.input === undefined ? null : (
          <>
            <UserMessage content={state.input} />
            <AgentThought content="Thinking about questions to research" />
          </>
        )}
        {state.questions === undefined ? null : (
          <AgentThought
            content={`Attempting to answer these questions:\n${state.questions.reduce(
              (acc, curr, index) => acc + `${index + 1}. ${curr.text}\n`,
              ""
            )}`}
          />
        )}
        {state.questions &&
        state.questions.some((q) => q.answer !== undefined) ? (
          <AgentThought content="Found answers to my questions... Thinking of follow up questions" />
        ) : null}
        {state.followUpQuestions === undefined ? null : (
          <AgentThought
            content={`Attempting to answer these follow up questions:\n${state.followUpQuestions.reduce(
              (acc, curr, index) => acc + `${index + 1}. ${curr.text}\n`,
              ""
            )}`}
          />
        )}
        {state.followUpQuestions &&
        state.followUpQuestions.some((q) => q.answer !== undefined) ? (
          <AgentThought content="Found answers to my follow up questions... Synthesizing my knowledge and coming up with new features" />
        ) : null}
        {state.features === undefined ? null : (
          <Features features={state.features} />
        )}
        {state.prd === undefined ? null : (
          <AgentThought
            content={`Here is the Product Requirements Document:\n${state.prd}\nShould I create tickets and add them to linear? (y/n)`}
          />
        )}
        {state.tasks === undefined ? null : <Tasks tasks={state.tasks} />}
        {state.tasks !== undefined && state.next?.agent === AgentType.END ? (
          <AgentThought content={"I've created the tickets in linear!"} />
        ) : null}
        {state.next?.agent === AgentType.END ? (
          <AgentThought content={"Done!"} />
        ) : null}
      </div>
      <form
        className="flex items-center gap-4"
        onSubmit={(event) => {
          let newState: State | undefined = undefined;
          if (!state.next) {
            newState = {
              ...state,
              input,
              next: {
                agent: AgentType.RESEARCH,
              },
            };
          } else if (state.next.agent === AgentType.RESEARCH) {
            newState = state;
          } else if (state.next.agent === AgentType.PRD) {
            if (!state.next.external_prompt) {
              console.log("invalid state!");
              return;
            }
            let feat = -1;
            try {
              feat = parseInt(input);
            } catch (e) {}
            if (feat < 1 || !state.features || feat > state.features.length) {
              console.log("invalid feature!");
              return;
            }
            newState = {
              ...state,
              features: [state.features[feat - 1]],
              next: {
                agent: state.next.agent,
                external_prompt: {
                  request: state.next.external_prompt.request,
                  response: {
                    type: ActionType.ConfirmFeature,
                  },
                },
              },
            };
          } else if (state.next.agent === AgentType.TICKETEER) {
            if (input !== "y" && input !== "n") {
              console.log("invalid input!");
              return;
            }
            newState = {
              ...state,
              next: {
                agent: input === "y" ? AgentType.TICKETEER : AgentType.END,
              },
            };
          } else if (state.next.agent === AgentType.END) {
            return;
          }

          if (newState === undefined) {
            console.log("invalid state!");
            return;
          }
          setState(newState);
          traverse(event, newState);
          setInput("");
        }}
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button>Send</Button>
      </form>
    </main>
  );
}
