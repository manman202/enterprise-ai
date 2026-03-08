# Aiyedun — User Guide

Welcome to Aiyedun, your organisation's self-hosted AI knowledge assistant. This guide covers everything you need to get started and use the platform effectively.

---

## Table of Contents

1. [Getting Access](#1-getting-access)
2. [Logging In](#2-logging-in)
3. [Starting a Chat](#3-starting-a-chat)
4. [Reading Citations](#4-reading-citations)
5. [Using Chat History](#5-using-chat-history)
6. [Searching the Knowledge Base](#6-searching-the-knowledge-base)
7. [Uploading Documents](#7-uploading-documents)
8. [Managing Your Profile](#8-managing-your-profile)
9. [Changing Your Password](#9-changing-your-password)
10. [Mobile Usage Tips](#10-mobile-usage-tips)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Getting Access

Contact your IT administrator to receive your account credentials. You will be given:

- A **username**
- A temporary **password** (change it on first login)
- The portal URL: `https://aiyedun.online`

You do not need to install anything — Aiyedun runs entirely in your web browser.

---

## 2. Logging In

1. Open `https://aiyedun.online` in your browser.
2. Enter your **username** and **password**.
3. Click **Sign in**.

If your account has been disabled, contact your IT administrator.

> The platform is LAN-only. You must be on the company network or VPN to access it.

---

## 3. Starting a Chat

The **Chat** page is where you interact with the AI assistant.

1. Click **Chat** in the left sidebar.
2. Type your question in the message box at the bottom of the screen.
3. Press **Enter** or click the **Send** button.
4. The assistant will reply within a few seconds.

**Example questions:**

- *"What is the company's annual leave policy?"*
- *"Summarise the onboarding checklist for new engineers."*
- *"What are the steps for requesting a travel expense reimbursement?"*

The assistant draws its answers from documents that have been uploaded to the knowledge base by your team. If a topic has not been documented, the assistant will say so.

**Tips for better answers:**

- Be specific. *"What is the parental leave policy for contract staff?"* gets a more useful answer than *"Leave policy?"*
- If the answer seems incomplete, follow up with *"Can you expand on that?"* or *"Give me more detail."*
- Ask one question at a time for clearest results.

---

## 4. Reading Citations

When the assistant's response is based on a specific document in the knowledge base, citations are displayed below the response.

Each citation shows:

- **Document name** — the filename of the source document.
- **Excerpt** — a short snippet of the relevant passage.
- **Score** — relevance score (closer to 1.0 = more relevant).

Citations allow you to verify information and locate the full source document. If no citations appear, the assistant answered from its general training knowledge rather than your organisation's documents.

---

## 5. Using Chat History

Aiyedun maintains your conversation within the current session. The conversation resets when you log out or close the browser tab.

**Within a session:**

- Scroll up in the chat window to review earlier messages.
- The assistant remembers the context of the current conversation, so you can ask follow-up questions without repeating context.

**Between sessions:**

- Conversation history is not persisted between logins in V1.
- If you need to save an important response, copy and paste it to a document before logging out.

---

## 6. Searching the Knowledge Base

The **Search** page lets you find relevant documents directly without starting a chat.

1. Click **Search** in the left sidebar.
2. Type a topic or phrase into the search bar.
3. Click **Search** or press **Enter**.
4. Results appear ranked by relevance, showing the document name and a matching excerpt.

Search uses semantic similarity — you do not need to match exact words. For example, searching *"employee benefits"* will also surface documents about *"staff perks"* and *"compensation packages"*.

---

## 7. Uploading Documents

Any team member can add documents to the knowledge base.

1. Click **Documents** in the left sidebar.
2. Click the **Upload** button.
3. Select a plain text file (`.txt`) or a text-based document.
4. The file is processed and indexed immediately.

**Best practices:**

- Use plain text or clean text exports for best indexing results.
- Name files clearly — the filename is shown in citations (e.g. `leave-policy-2026.txt`).
- Split very large documents into logical sections for more precise search results.

To remove a document, click the **Delete** (trash) icon next to it in the document list.

---

## 8. Managing Your Profile

1. Click **Settings** in the left sidebar.
2. Under **Profile**, update your **username** or **email address**.
3. Click **Save changes**.

Your username is what appears on your account and what you use to log in.

---

## 9. Changing Your Password

1. Click **Settings** in the left sidebar.
2. Scroll to the **Password** section.
3. Enter your **current password**.
4. Enter and confirm your **new password**.
5. Click **Update password**.

Use a strong password — at least 12 characters, mixing letters, numbers, and symbols. Your administrator cannot retrieve your password, only reset it.

---

## 10. Mobile Usage Tips

Aiyedun works in any modern mobile browser. For the best experience:

- **Rotate to landscape** for more comfortable reading of long AI responses.
- **Use the sidebar toggle** (hamburger menu, top-left) to navigate between pages — the sidebar auto-hides on small screens.
- **Tap the chat input** at the bottom of the screen to open your keyboard. The view will scroll automatically so the input stays visible.
- **Long-press text** in a response to copy it to your clipboard.
- **Add to home screen:** In Safari (iOS) or Chrome (Android), tap Share → "Add to Home Screen" for an app-like experience.
- The platform works on slow LAN Wi-Fi — responses from the AI may take 5–15 seconds on busy networks.

---

## 11. Troubleshooting

| Problem | Steps to resolve |
|---------|-----------------|
| Cannot log in | Check username/password. Ensure you are on the company network or VPN. Contact IT if your account may be disabled. |
| AI response is very slow | The AI model runs locally — response time depends on server load. Wait 30 seconds and try again. |
| AI says it doesn't know something | The topic may not be in the knowledge base. Upload a relevant document and ask again. |
| Search returns no results | No documents have been uploaded yet, or the query topic is not covered. Try different keywords. |
| Document upload fails | Ensure the file is plain text and under 50 MB. Binary files (images, Word docs) are not supported in V1. |
| Page won't load | Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R). Try a different browser. Check your network connection. |
| Logged out unexpectedly | Sessions expire after 8 hours. Log back in to continue. |

For issues not listed here, contact your IT administrator and provide:
- The URL you were visiting
- What you were trying to do
- Any error message shown on screen
