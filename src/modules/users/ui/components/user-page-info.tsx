import { UserAvatar } from "@/components/user-avatar";
import { UserGetOneOutput } from "../../types";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import SubscriptionButton from "@/modules/subscriptions/ui/components/subscription-button";
import { useSubscription } from "@/modules/subscriptions/hooks/use-subscription";

interface UserPageInfoProps {
  user: UserGetOneOutput;
}

const UserPageInfo = ({ user }: UserPageInfoProps) => {
  const { userId, isLoaded } = useAuth();
  const clerk = useClerk();
  const {
    name,
    imageUrl,
    subscriberCount,
    videoCount,
    clerkId,
    viewerSubscribed,
  } = user;
  const { isPending, onClick } = useSubscription({
    userId: user.id,
    isSubscribed: viewerSubscribed,
  });
  return (
    <div className="py-6">
      <div className="flex flex-col md:hidden">
        <div className="flex items-center gap-3">
          <UserAvatar
            size="lg"
            imageUrl={imageUrl}
            name={name}
            className="h-[60px] w-[60px]"
            onClick={() => {
              if (user.clerkId === userId) {
                clerk.openUserProfile();
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{name}</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{subscriberCount} subscribers</span>
              <span>&bull;</span>
              <span>{videoCount} videos</span>
            </div>
          </div>
        </div>
        {clerkId === userId ? (
          <Button variant="secondary" asChild className="rounded-full mt-3">
            <Link href="/studio">Go to Studio</Link>
          </Button>
        ) : (
          <SubscriptionButton
            disabled={isPending || !isLoaded}
            isSubscribed={viewerSubscribed}
            onClick={onClick}
            className="mt-3 w-full"
          />
        )}
      </div>
    </div>
  );
};

export default UserPageInfo;
