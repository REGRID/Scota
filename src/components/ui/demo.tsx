import * as React from "react";
import { NotificationPanel, type NotificationItem } from "@/components/ui/notification-panel";

/* Portraits are inlined as WebP data URIs so the demo fetches nothing. */
const PORTRAITS = {
  sarah: "data:image/webp;base64,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",
  michael: "data:image/webp;base64,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",
  emily: "data:image/webp;base64,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",
  daniel: "data:image/webp;base64,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",
  olivia: "data:image/webp;base64,UklGRnIHAABXRUJQVlA4IGYHAACwIgCdASpwAHAAPpE+mkkloyKhKJJ84LASCUAZ64tapBwH3tuXzx+nTRyLl0ECL9pxUy3sAH1i4tOCU8TqN/0TtBL1T7A3SdaUXcBOONXhkZNqGtU6CLGhvyGxSlv9clN2c7gG0W0g2P10+yWlCnV1pA9ckQhOU04r/rKMs+iYTWP9rSXchMnNSQYptm7MQbepm6qVT5D7dtIc8xsv1L10bDHIoVY+xkVwbGI3SaMnbaUn2HQt+DRY2Pfvf6KhLfh2xTFKruPfjaGnSC4H8/nVDEHSJcL7k4T7im+3udCB/oTDWU25H5NidM8MpiZpgboefOghbFM54spbtNpb26QzOQmpfJP+Rj6JDCDvxkBqtYzDB8D7FkdW1ZN8UX3AAP784gGGYFYk1V67KV7Lk8ioOEbWUNexfek0wG/pAHO69yCwzEVKk3Z8nuIzYUPPf628ZKcYECcLcsdp/Yq4CwYcc+LZYPmdk+WnaY4K74WZfcrbT6wq5Ymn2iU49j8LPBsR/QugROHZLxQQ1vu8f97uj6XBoSJNJmPLEW2NjdU4ngV6J4elMibBzg153QJ4GBEyRfFWwtTuCT9j8T5mJNlxp/V/aT5H/QYNB3365sI1jKCZH8mvhqMmTN5q6dAkehRn1V8sxaUW0MnSpLMKC9SSoYdxCa7Ow2XJjA1xTkDW2qZTcALQQWp/7rg5MrSkc/QiJIXlJziqSdIexaoXnEdQUM8yxerUwOQQ6i0MrzO36xyXjStDzuoT8T9XV9e61O5m8bnkcXi15EjK2ZUZbhN81dps71EfnTATx0ZrStKnd838ctd8XBeDRYyHcnfvUrw2KGu4WJpcjz6Qm8yDRo3bLWZMepe2inyitcvBLU5fcMq64XrWYlCtbuV7xlwBio7icxNf0bYoyFgQteepGgfraRAyRzYXEtGfCKEKmlJzYZ8b9Oh+kGtwPcWEy/fVEnSmDEm6FANL97F/WW9Su+qiLgL56rJOV9n0ggmDWDsTvd81EXoh6HgtzjkkTKnfMD2AClm5v7DGW4rfoMmbzhRp1kpw+1iCN+YBCjyf+N+F1wzG0wkSO/tDTF4+Fxm1aFJ99wskCsuoXPpWAFPB+J6+ZU9lun3mbwPxlQF91Jrb2mAwI6AIVOs9+GdcOHbKxK7Gr/RFnvHB4hvZzM6UulKW9TWvap/9S2Gt0Iws/ZAB3+robdD2Ymk6445wFNkClk1PMB1Bq7uFu7vmrwowafO9L5dq+sewnFXoibgvcSQa14Q1mCsSIfZqFunVacsvk6bzC/to8QCbQZaK4n1QHmu7zY0H6p8QIMi01n9Lo+c6kWFnBqn6SW7PfcpqQAq4NhuiZfUi59Nw8VWH39g6go4KXvNyqWUwmXXR4Yx/Sl0hsX7B/RK6Y8KsMMqTeESwGOHx2IXuP2KaYKPDby+nylYHX7rPBlpT4PfnOCwU9VY/fcw5n6D+5oTJkej2O0zeSPQckzKyoL1XPHvzUGFfzrnj7OTNrt0h5xtXEQ/nhs7+9lhoz0td9kHmuyGNjDt3Im1OUvEAbgyGykqFqI1ftDkv7vAFrw0OXO4UeN7yqlIZ4CixcfnTfzcBpy5bkx9gabSCpjSEGEfkwBrxLr4h9w7STfbsp0Ma/h43LrcV+/3PSAEyFM5NPO7/2PJl7PMK7UfevBTxl9PX3odR6ANdEFAZmTChdKutWxTQ69qc4nQ+3LuyMxsD36YmoQHR+o1QllMRNxRwOfNhG1MZj8w2tEs0aBrHjiDtDoSczniFkyQhR+GQBBdNWe1QSZroqc7wBXXIV7zWaFiV/86JvvmLGweVmHBNt/tyK7h0VCAeZ6ZDHTqkiQg9zcDZQ7zKjp65uX0H1E3U/YELZHxNsgMLrgV/LnompeKn9VYdWTIRPAOlc0KfjAdENrq358T0CaV7pf/qNIWk91Lg54Tyb6YPuu90euiOVkZmcFZoY11F4XmDlQM2H6Ms3g2C9ynomDv3wwT8wYJJ3IcSGTS9u1eYHkXnBLja9auQsBVKVRM34rqH0kfWYQiO97KVKdMRFWW6NNVRto/eP4b1H4LbQyStrb8hd58OllrI7Hzob2wuPtIdcwMvT8atlo8yJ1Pm4rcnXGIJbzu65SwDfmkonIVi9Qy1QJ0GFB5BNoWQ4S2FXHGhaniTyRQ5kHUn1NLPBCudmHXRlUDLKmNKqDrz8RiljVKftu7BJNATq2oW/zeLO7iD5ffFG1AqqKHlyJSsovd5AmmOx2ZziGi9bphgOMh+kg8rxRPTTsVg1Ut3zMuDPvUy4DYahN7vrDv72j456QQFxP63KSGK5LP419hQbv1zzP5Uh5Puorxi0eKJmztFx75e+p/kx39ZMqxgIoElNKbfGOLeInC2LiV7RCJvSZ8SEnqtgVVd1LjzNUlwMUIq3t8B7nd3vvnj6/pnPs51yDlJNSmklOrbz3+rN8UjQ2/wg0O8w0Dk2J6jeGMamxLU7SXqTueKiUS1KaUThOukbdhKPsqM2/mfGNoeZQgXTmonDHLcgcEO2AAA",
} as const;


const ITEMS: NotificationItem[] = [
  {
    id: "n1",
    actor: { name: "Michael Carter", avatar: PORTRAITS.michael },
    kind: "mention",
    body: ["mentioned you in ", { entity: "Design review" }],
    quote: "Can you take the empty states before Thursday?",
    time: "12 min ago",
    context: ["Product", "Q3 roadmap"],
    unread: true,
    following: true,
  },
  {
    id: "n2",
    actor: { name: "Emily Thompson", avatar: PORTRAITS.emily },
    kind: "request",
    body: ["is requesting edit access to ", { entity: "Brand kit" }],
    time: "1 hour ago",
    context: ["Design system"],
    unread: true,
    actions: [
      { id: "approve", label: "Approve", tone: "primary", resolved: "You approved the request" },
      { id: "deny", label: "Deny", resolved: "You denied the request" },
    ],
  },
  {
    id: "n3",
    actor: { name: "Daniel Wilson", avatar: PORTRAITS.daniel },
    kind: "file",
    body: ["uploaded a file to ", { entity: "Launch assets" }],
    attachment: { name: "landing-page-v4.fig", size: "2.4 MB" },
    time: "3 hours ago",
    context: ["Marketing"],
    unread: true,
    following: true,
  },
  {
    id: "n4",
    actor: { name: "Olivia Martinez", avatar: PORTRAITS.olivia },
    kind: "edit",
    body: ["edited ", { entity: "Pricing page" }],
    count: 6,
    time: "Yesterday",
    context: ["Website"],
  },
  {
    id: "n5",
    actor: { name: "Priya Raman" },
    kind: "due",
    body: ["moved the due date of ", { entity: "Mobile push setup" }, " to Sep 12"],
    time: "Yesterday",
    context: ["Product", "Sprint 24"],
    following: true,
  },
  {
    id: "n6",
    actor: { name: "Sarah Anderson", avatar: PORTRAITS.sarah },
    kind: "comment",
    body: ["left a comment on ", { entity: "Search across workspaces" }],
    quote: "Debounce feels good now — 240ms reads as instant.",
    time: "28 Apr",
    context: ["Product"],
  },
  {
    id: "n7",
    actor: { name: "Tom Okafor" },
    kind: "join",
    body: ["joined ", { entity: "Delivery team" }],
    time: "28 Apr",
    context: ["People"],
  },
  {
    id: "n8",
    actor: { name: "Sarah Anderson", avatar: PORTRAITS.sarah },
    kind: "created",
    body: ["created ", { entity: "Northwind Cloud" }],
    time: "29 Mar",
    context: ["Workspace"],
    archived: true,
  },
];


export default function NotificationPanelDemo() {
  return (
    <div className="flex w-full justify-center bg-background px-6 py-10">
      <div className="w-full max-w-[440px]">
        <NotificationPanel
          items={ITEMS}
          maxHeight={420}
          className="shadow-[0_24px_60px_-18px_rgb(0_0_0/0.18)]"
        />
      </div>
    </div>
  );
}
