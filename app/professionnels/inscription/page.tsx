import type{Metadata}from'next';
import{requireAccountUser}from'../../account-auth';
import{ProfessionalOnboarding}from'../../components/ProfessionalOnboarding';
import{SiteHeader}from'../../components/SiteHeader';
export const metadata:Metadata={title:'Compte professionnel — Mémoire Maison',robots:{index:false,follow:false}};
export default async function ProfessionalSignUp(){await requireAccountUser('/professionnels/inscription');return <><SiteHeader compact/><ProfessionalOnboarding/></>}
