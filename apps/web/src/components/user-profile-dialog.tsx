import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@nyte/ui/components/dialog";

import { authClient } from "~/lib/auth-client";

export const UserProfileDialog = () => {
  const user = authClient.useSession().data?.user;
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle> {user?.name} </DialogTitle>
          <DialogDescription> {user?.email} </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
