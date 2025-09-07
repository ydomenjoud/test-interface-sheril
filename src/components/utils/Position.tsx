import {XY} from "../../types";
import {isPos, parsePosString} from "../../utils/position";


type Props = {
    pos?: XY | string | undefined;
};

export default function Position({pos}: Props) {
    if(typeof pos === 'string') {
        pos = isPos(pos) ? parsePosString(pos) : undefined;
    }
    if(pos === undefined) return <></>;
    if(pos.x === 0 && pos.y === 0) return <></>;

    const f = (n: number) => n.toString().padStart(2, '0');

    return <span className={'position'}>[{f(pos.x)}-{f(pos.y)}]</span>;
}
