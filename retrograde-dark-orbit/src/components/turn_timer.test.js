import { render } from '@testing-library/react'
import TurnTimer from './turn_timer';
import "setimmediate";

it('renders on-screen', () => {
    const page = render(<TurnTimer/>);
    expect(page).toMatchSnapshot();
});
