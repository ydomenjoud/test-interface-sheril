import {useReport} from "../../context/ReportContext";

type Props = {
    num?: number;
};

export default function Commandant({num}: Props) {

    const {global} = useReport();

    if (num === 0) return <span className={'commandant neutre'}>
           Neutre &nbsp;
        </span>

    if (!global || !global.commandants || !num) return <></>;


    const commandant = global.commandants.find(c => c.numero === num);
    if (!commandant) return <></>;


    return (<span className={'commandant race' + commandant.raceId}>
            {commandant.nom} ({commandant.numero}) &nbsp;
        </span>);
}
