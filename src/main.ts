import { Devvit } from "@devvit/public-api";
import { sliceOut } from "./helpers.js";
import { jsonEncode, ResolveSecondsAfter } from "anthelpers";

Devvit.configure({
  redditAPI: true,
  redis: true
});

Devvit.addTrigger({
  event: "ModMail",
  onEvent: async (event, context) => {
    const userId = event.messageAuthor?.id as string | null,
      conversationId = event.conversationId.split(/_/)[1], username = event.messageAuthor?.name;
    if (!userId) return; if (username === undefined && username === context.appSlug) return;
    const messagesArray = Object.values((await context.reddit.modMail.getConversation({
      conversationId
    })).conversation?.messages ?? new Array);
    const latestMessage = messagesArray[messagesArray.length - 1];
    const commandMatch = latestMessage.bodyMarkdown.trim().match(
      /!mute(?:\s*user)?\s+(\d+)\s+(hour|minute|second|day|h|m|s|d)s?\b/i
    ) as RegExpMatchArray | null;
    if (commandMatch) {
      const unit = commandMatch[2].charAt(0).toLowerCase();
      let units = +commandMatch[1], seconds = units, unitMatched;
      switch (unit) {
        case "s":
          seconds = seconds;
          unitMatched = 'Seconds';
          break;
        case "h":
          seconds = seconds * 60;
          unitMatched = 'Hours';
        case "m":
          seconds = seconds * 60;
          if (unitMatched !== 'Hours')
            unitMatched = 'Minutes';
          break;
        case "d":
          seconds = seconds * 86400;
          unitMatched = 'Days';
          break;
        default:
          await context.reddit.modMail.reply({
            isInternal: true, conversationId,
            body: `i dont understand what unit that is`,
          });
          return;
      }
      if (seconds < 3) {
        await context.reddit.modMail.reply({
          isInternal: true, conversationId,
          body: `why?`,
        });
        return;
      }
      if (seconds < 15) {
        await context.reddit.modMail.reply({
          isInternal: true, conversationId,
          body: `you must mute larger than 15 seconds`,
        });
        return;
      }

      const now = Date.now(), runAt = ResolveSecondsAfter(seconds, now);
      const body = `You have been muted by the subreddit Moderators for ${units} ${unitMatched}\n\nYou will be automatically` +
        ` unmuted at about ${sliceOut(String(runAt), 21, 33, true)}\n\nassuming u/${context.appSlug} is still installed then`;
      await context.reddit.modMail.reply({
        body, conversationId,
        isAuthorHidden: true,
      });
      const jobId = await context.scheduler.runJob({
        name: 'unmuteTimeCustom', runAt,
        data: { userId, conversationId },
      }), expiration = runAt;
      await context.redis.set(`user-unmuteAt-${userId}`,
        jsonEncode({ expiration, jobId, userId }), { expiration });
      await context.reddit.modMail.muteConversation({
        conversationId, numHours: 672,
      });
    }
  },
});

Devvit.addSchedulerJob({
  name: 'unmuteTimeCustom', async onRun(event, context) {
    if (event.data) {
      const { userId, conversationId }: { userId: string, conversationId: string } = event.data as any;
      const conversation = await context.reddit.modMail.getConversation({ conversationId });
      if (conversation?.conversation) {
        await context.reddit.modMail.unmuteConversation(conversationId);
        console.log(`userId=(${userId}) is unmuted`);
      }
    }
  },
});

// Devvit.addTrigger({
//   event: 'AppUpgrade',
//   async onEvent(_event, context) {
//     await Promise.allSettled((await context.scheduler.listJobs()).map(m => {  // @ts-expect-error
//       const newJob = context.scheduler.runJob({ runAt: new Date(m.data.expiration), data: m.data, name: m.name });
//       return Promise.allSettled([context.scheduler.cancelJob(m.id), newJob]);
//     }));
//   }
// });

export default Devvit;