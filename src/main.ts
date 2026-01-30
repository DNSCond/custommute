import { Devvit } from "@devvit/public-api";
import { sliceOut } from "./helpers.js";
import { jsonEncode, ResolveSecondsAfter } from "anthelpers";
import { ConversationWrapperFromEvent } from "./ConversationWrapper.js";

Devvit.configure({
  redditAPI: true,
  redis: true
});

Devvit.addTrigger({
  event: "ModMail",
  onEvent: async (event, context) => {
    console.log('hello', Date());

    const conversation = new ConversationWrapperFromEvent(event, context);
    await conversation.load();

    console.log(jsonEncode({
      conversation,
      messages: conversation.messages() ?? null,
    }, true));
  },
});

export default Devvit;
