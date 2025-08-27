import { auth } from '../lib/auth';
import { redirect } from 'next/navigation';
import { ChatLayout } from '../components/chat/ChatLayout';

export default async function HomePage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return <ChatLayout user={session.user} />;
}