import { env } from "../config/env.js";

export type SendWebexTextParams = {
  roomId: string;
  text: string;
};

export type SendWebexTextResult = {
  sent: boolean;
  messageId?: string;
  reason?: string;
};

export type WebexMessageDetails = {
  id: string;
  roomId: string;
  text: string;
  personId?: string;
};

export type CreateWebexRoomResult = {
  created: boolean;
  roomId?: string;
  title?: string;
  reason?: string;
};

export type AddWebexRoomMemberResult = {
  added: boolean;
  membershipId?: string;
  reason?: string;
};

function hasWebexToken(): boolean {
  return Boolean(env.WEBEX_BOT_ACCESS_TOKEN);
}

async function webexRequest(path: string, init: RequestInit): Promise<Response | null> {
  if (!hasWebexToken()) {
    return null;
  }

  const headers = {
    Authorization: `Bearer ${env.WEBEX_BOT_ACCESS_TOKEN}`,
    ...(init.headers ?? {})
  };

  return fetch(`https://webexapis.com/v1${path}`, {
    ...init,
    headers
  });
}

export async function sendWebexTextMessage(params: SendWebexTextParams): Promise<SendWebexTextResult> {
  if (!env.WEBEX_BOT_ACCESS_TOKEN) {
    return {
      sent: false,
      reason: "WEBEX_BOT_ACCESS_TOKEN missing"
    };
  }

  const response = await webexRequest("/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomId: params.roomId,
      text: params.text
    })
  });

  if (!response) {
    return {
      sent: false,
      reason: "WEBEX_BOT_ACCESS_TOKEN missing"
    };
  }

  if (!response.ok) {
    const responseText = await response.text();
    return {
      sent: false,
      reason: `Webex API error (${response.status}): ${responseText}`
    };
  }

  const data = (await response.json()) as { id?: string };
  return {
    sent: true,
    messageId: data.id
  };
}

export async function createWebexRoom(title: string): Promise<CreateWebexRoomResult> {
  if (!title.trim()) {
    return {
      created: false,
      reason: "Room title is required"
    };
  }

  const response = await webexRequest("/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });

  if (!response) {
    return {
      created: false,
      reason: "WEBEX_BOT_ACCESS_TOKEN missing"
    };
  }

  if (!response.ok) {
    const responseText = await response.text();
    return {
      created: false,
      reason: `Webex room create failed (${response.status}): ${responseText}`
    };
  }

  const data = (await response.json()) as { id?: string; title?: string };
  return {
    created: true,
    roomId: data.id,
    title: data.title
  };
}

export async function addWebexRoomMember(params: {
  roomId: string;
  personId?: string;
  personEmail?: string;
  isModerator?: boolean;
}): Promise<AddWebexRoomMemberResult> {
  if (!params.roomId) {
    return {
      added: false,
      reason: "roomId is required"
    };
  }

  if (!params.personId && !params.personEmail) {
    return {
      added: false,
      reason: "personId or personEmail is required"
    };
  }

  const response = await webexRequest("/memberships", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomId: params.roomId,
      personId: params.personId,
      personEmail: params.personEmail,
      isModerator: params.isModerator ?? false
    })
  });

  if (!response) {
    return {
      added: false,
      reason: "WEBEX_BOT_ACCESS_TOKEN missing"
    };
  }

  if (!response.ok) {
    const responseText = await response.text();
    return {
      added: false,
      reason: `Webex membership add failed (${response.status}): ${responseText}`
    };
  }

  const data = (await response.json()) as { id?: string };
  return {
    added: true,
    membershipId: data.id
  };
}

export async function fetchWebexMessageById(messageId: string): Promise<WebexMessageDetails | null> {
  if (!env.WEBEX_BOT_ACCESS_TOKEN) {
    return null;
  }

  const response = await webexRequest(`/messages/${messageId}`, {
    method: "GET"
  });

  if (!response || !response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    id?: string;
    roomId?: string;
    text?: string;
    personId?: string;
  };

  if (!data.id || !data.roomId) {
    return null;
  }

  return {
    id: data.id,
    roomId: data.roomId,
    text: data.text ?? "",
    personId: data.personId
  };
}
