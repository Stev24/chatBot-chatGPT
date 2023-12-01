import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // defaults to process.env["OPENAI_API_KEY"]
});

let thread;

export default defineEventHandler(async (event) => {
  const previosMessages = await readBody(event);

  const lastMessageObject = previosMessages.pop();

  // Create a thread
  if (lastMessageObject?.conversationStart) {
    thread = await openai.beta.threads.create();
    console.log("initiate thread", thread);
  }

  
  // Pass in the user question into the existing thread
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: lastMessageObject?.message,
  });

  // Use runs to wait for the assistant response and then retrieve it
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: process.env["OPENAI_ASSISTANT_ID"],
  });

  console.log(thread.id, run.id);
  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

  // Polling mechanism to see if runStatus is completed
  // This should be made more robust.
  while (runStatus.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  }

  // Get the last assistant message from the messages array
  const messages = await openai.beta.threads.messages.list(thread.id);

  // Find the last message for the current run
  const lastMessageForRun = messages.data
    .filter(
      (message) => message.run_id === run.id && message.role === "assistant"
    )
    .pop();

  console.log(lastMessageForRun.content[0].text.value);

  return {
    message: lastMessageForRun.content[0].text.value,
  };
});
