import type{Metadata}from'next';
import{requireChatGPTUser}from'../../chatgpt-auth';
import{ProfessionalOnboarding}from'../../components/ProfessionalOnboarding';
import{SiteHeader}from'../../components/SiteHeader';
export const metadata:Metadata={title:'Compte professionnel — Mémoire Maison',robots:{index:false,follow:false}};
export default async function ProfessionalSignUp(){await requireChatGPTUser('/professionnels/inscription');return <><SiteHeader compact/><ProfessionalOnboarding/></>}
