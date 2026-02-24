"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nyte/ui/components/tabs";

import { NotificationFeed } from "./notification-feed";

export function CommandCenter() {
  return (
    <Tabs defaultValue="important" className="min-h-0 flex-1">
      <TabsList className="w-full">
        <TabsTrigger value="important">Important</TabsTrigger>
      </TabsList>
      <TabsContent value="important" className="min-h-0 flex-1">
        <NotificationFeed />
      </TabsContent>
    </Tabs>
  );
}
